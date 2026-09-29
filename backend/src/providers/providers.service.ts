import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AIProvider, Prisma } from '@prisma/client';
import { ChatModel, OpenAICompatibleChatModel } from '../ai/chat-model';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto, UpdateProviderDto } from './providers.dto';
import { SecretBox } from './secret-box';

export interface ResolvedModel {
  model: ChatModel;
  providerName: string;
  modelName: string;
}

/** The API shape. The key itself never leaves the server; clients only learn whether one is set. */
function toView(p: AIProvider) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    baseUrl: p.baseUrl,
    model: p.model,
    isDefault: p.isDefault,
    hasApiKey: p.encryptedApiKey !== null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

@Injectable()
export class ProvidersService {
  private readonly box = new SecretBox(config().ENCRYPTION_KEY);

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const providers = await this.prisma.aIProvider.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      providers: providers.map(toView),
      // Lets the UI explain that reviews still work without a configured provider.
      environmentFallback: envFallback() ? { model: config().OPENAI_MODEL } : null,
    };
  }

  async create(userId: string, dto: CreateProviderDto) {
    const isFirst = (await this.prisma.aIProvider.count({ where: { userId } })) === 0;
    const isDefault = isFirst || dto.isDefault === true;
    return this.withUniqueName(() =>
      this.prisma.$transaction(async (tx) => {
        if (isDefault) await this.clearDefault(tx, userId);
        const created = await tx.aIProvider.create({
          data: {
            userId,
            name: dto.name,
            type: dto.type,
            baseUrl: dto.baseUrl,
            model: dto.model,
            isDefault,
            encryptedApiKey: dto.apiKey ? this.box.encrypt(dto.apiKey) : null,
          },
        });
        return toView(created);
      }),
    );
  }

  async update(userId: string, id: string, dto: UpdateProviderDto) {
    await this.getOwned(userId, id);
    const data: Prisma.AIProviderUpdateInput = {
      name: dto.name,
      type: dto.type,
      baseUrl: dto.baseUrl,
      model: dto.model,
      ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      ...(dto.apiKey !== undefined && {
        encryptedApiKey: dto.apiKey === '' ? null : this.box.encrypt(dto.apiKey),
      }),
    };
    return this.withUniqueName(() =>
      this.prisma.$transaction(async (tx) => {
        if (dto.isDefault === true) await this.clearDefault(tx, userId);
        return toView(await tx.aIProvider.update({ where: { id }, data }));
      }),
    );
  }

  async delete(userId: string, id: string) {
    const provider = await this.getOwned(userId, id);
    await this.prisma.aIProvider.delete({ where: { id } });
    if (provider.isDefault) {
      const next = await this.prisma.aIProvider.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (next)
        await this.prisma.aIProvider.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  /** Sends a trivial prompt so users can verify URL, key and model before running a review. */
  async test(userId: string, id: string) {
    const { model } = this.toResolved(await this.getOwned(userId, id));
    const started = Date.now();
    const reply = await model.complete([
      { role: 'user', content: 'Reply with the single word: OK' },
    ]);
    return { ok: true, latencyMs: Date.now() - started, reply: reply.slice(0, 200) };
  }

  /**
   * Picks the model for an AI request: the explicitly requested provider, else the user's
   * default, else the server's environment fallback.
   */
  async resolve(userId: string, providerId?: string): Promise<ResolvedModel> {
    if (providerId) return this.toResolved(await this.getOwned(userId, providerId));

    const preferred = await this.prisma.aIProvider.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (preferred) return this.toResolved(preferred);

    const env = envFallback();
    if (env) {
      return {
        model: new OpenAICompatibleChatModel({ ...env, timeoutMs: config().AI_TIMEOUT_MS }),
        providerName: 'Server default',
        modelName: env.model,
      };
    }
    throw new BadRequestException(
      'No AI provider configured. Add one under Settings → AI Providers.',
    );
  }

  private toResolved(p: AIProvider): ResolvedModel {
    return {
      model: new OpenAICompatibleChatModel({
        baseUrl: p.baseUrl,
        apiKey: p.encryptedApiKey ? this.box.decrypt(p.encryptedApiKey) : null,
        model: p.model,
        timeoutMs: config().AI_TIMEOUT_MS,
      }),
      providerName: p.name,
      modelName: p.model,
    };
  }

  private async getOwned(userId: string, id: string) {
    const provider = await this.prisma.aIProvider.findFirst({ where: { id, userId } });
    if (!provider) throw new NotFoundException('AI provider not found');
    return provider;
  }

  private clearDefault(tx: Prisma.TransactionClient, userId: string) {
    return tx.aIProvider.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  private async withUniqueName<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You already have a provider with this name');
      }
      throw err;
    }
  }
}

function envFallback() {
  const { OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL } = config();
  if (!OPENAI_BASE_URL || !OPENAI_MODEL) return null;
  return { baseUrl: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY || null, model: OPENAI_MODEL };
}
