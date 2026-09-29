"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeOpenAI = void 0;
const node_http_1 = require("node:http");
class FakeOpenAI {
    requests = [];
    replies = [];
    server;
    async start() {
        this.server = (0, node_http_1.createServer)(async (req, res) => {
            const body = JSON.parse(await readBody(req));
            this.requests.push({ url: req.url ?? '', authorization: req.headers.authorization, body });
            const reply = this.replies.shift() ?? { content: 'OK' };
            if (reply.delayMs)
                await new Promise((r) => setTimeout(r, reply.delayMs));
            res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(reply.body ?? { choices: [{ message: { role: 'assistant', content: reply.content } }] }));
        });
        await new Promise((resolve) => this.server.listen(0, '127.0.0.1', resolve));
        return `http://127.0.0.1:${this.server.address().port}/v1`;
    }
    reply(...replies) {
        this.replies.push(...replies);
    }
    reset() {
        this.requests.length = 0;
        this.replies.length = 0;
    }
    stop() {
        return new Promise((resolve) => this.server.close(() => resolve()));
    }
}
exports.FakeOpenAI = FakeOpenAI;
function readBody(req) {
    return new Promise((resolve) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => resolve(data));
    });
}
//# sourceMappingURL=fake-openai.js.map