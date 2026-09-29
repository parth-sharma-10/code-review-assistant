import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import { AiService, BUDGETS } from '../ai/ai.service';
import type { ChatMessage } from '../ai/chat-model';
import { RetrievalService } from '../files/retrieval.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ProvidersService } from '../providers/providers.service';

/** Prior turns sent with each question, so follow-ups ("and where is it called?") work. */
const HISTORY_MESSAGES = 6;
const HISTORY_CHARS_PER_MESSAGE = 2000;

const messageSelect = { id: true, role: true, content: true, contextFiles: true, createdAt: true };

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly providers: ProvidersService,
    private readonly retrieval: RetrievalService,
    private readonly ai: AiService,
  ) {}

  async createSession(userId: string, projectId: string) {
    await this.projects.getOwned(userId, projectId);
    return this.prisma.chatSession.create({
      data: { userId, projectId, title: 'New chat' },
      select: { id: true, title: true, createdAt: true },
    });
  }

  async listSessions(userId: string, projectId: string) {
    await this.projects.getOwned(userId, projectId);
    return this.prisma.chatSession.findMany({
      where: { userId, projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, createdAt: true },
    });
  }

  async getMessages(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        title: true,
        projectId: true,
        messages: { orderBy: { createdAt: 'asc' }, select: messageSelect },
      },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  async sendMessage(userId: string, sessionId: string, content: string, providerId?: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        projectId: true,
        messages: { orderBy: { createdAt: 'desc' }, take: HISTORY_MESSAGES, select: messageSelect },
      },
    });
    if (!session) throw new NotFoundException('Chat session not found');

    const askedAt = new Date();
    const resolved = await this.providers.resolve(userId, providerId);
    const [files, projectFileCount] = await Promise.all([
      this.retrieval.forQuestion(session.projectId, content, BUDGETS.chat),
      this.prisma.file.count({ where: { projectId: session.projectId } }),
    ]);
    const history: ChatMessage[] = session.messages.reverse().map((m) => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.content.slice(0, HISTORY_CHARS_PER_MESSAGE),
    }));

    const { answer, contextFiles } = await this.ai.chat(resolved.model, {
      question: content,
      history,
      files,
      projectFileCount,
    });

    // Persist both turns only after the model answered, so a failed request leaves no orphan.
    // Explicit timestamps: rows in one transaction would otherwise tie on createdAt.
    const [userMessage, assistantMessage] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { sessionId, role: MessageRole.USER, content, contextFiles: [], createdAt: askedAt },
        select: messageSelect,
      }),
      this.prisma.message.create({
        data: {
          sessionId,
          role: MessageRole.ASSISTANT,
          content: answer,
          contextFiles,
          createdAt: new Date(),
        },
        select: messageSelect,
      }),
      ...(session.messages.length === 0
        ? [
            this.prisma.chatSession.update({
              where: { id: sessionId },
              data: { title: titleFrom(content) },
            }),
          ]
        : []),
    ]);
    return { userMessage, assistantMessage };
  }
}

function titleFrom(question: string): string {
  const oneLine = question.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}...` : oneLine;
}
