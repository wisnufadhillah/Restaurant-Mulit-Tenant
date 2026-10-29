const fs = require('node:fs');
const file = 'docs/api/openapi.json';
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
const sample = spec.paths['/staff/tenants/{slug}/session'].get.responses;
const error = status => structuredClone(sample[status] ?? sample[500]);
const responses = success => ({ [success]: { description: success === 204 ? 'Revoked; no response body' : 'Validated chat result; no bearer or internal context in JSON' }, 400: error(400), 403: error(403), 429: error(429), 500: error(500), 503: error(503) });
const origin = { name: 'Origin', in: 'header', required: true, schema: { type: 'string', format: 'uri' } };
spec.components.securitySchemes.chatCookie = { type: 'apiKey', in: 'cookie', name: 'restaurant_chat' };
spec.paths['/chat/session'] = {
  post: { operationId: 'createChatSession', summary: 'Create/reuse application-bound public tenant session', parameters: [origin], responses: responses(200) },
  get: { operationId: 'readChatSession', summary: 'Read active chat session public ID and expiry', security: [{ chatCookie: [] }], responses: responses(200) },
  delete: { operationId: 'revokeChatSession', summary: 'Revoke session and clear cookie', security: [{ chatCookie: [] }], parameters: [origin], responses: responses(204) },
};
spec.paths['/chat/messages'] = { post: { operationId: 'sendChatMessage', summary: 'Bounded read-only assistant turn; dependency failures return explicit unavailable status and web fallback', security: [{ chatCookie: [] }], parameters: [origin], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['message'], properties: { message: { type: 'string', minLength: 1, maxLength: 2000 } } } } } }, responses: responses(200) } };
spec.paths['/chat/catalogue/{resource}'] = { get: { operationId: 'readChatCatalogue', summary: 'Read explicit catalogue card using active chat session; no inference', security: [{ chatCookie: [] }], parameters: [{ name: 'resource', in: 'path', required: true, schema: { enum: ['menu', 'restaurant', 'hours'] } }], responses: { ...responses(200), 404: error(404) } } };
for (const resource of ['restaurant', 'menu']) spec.paths[`/internal/tenants/{slug}/${resource}`] = { get: { operationId: `internalRead${resource}`, summary: 'Service authentication plus signed active tenant/session context required; never call from browser', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }, ...['x-internal-service-token', 'x-internal-context', 'x-session-id'].map(name => ({ name, in: 'header', required: true, schema: { type: 'string' } }))], responses: { ...responses(200), 401: error(401), 404: error(404) } } };
fs.writeFileSync(file, `${JSON.stringify(spec, null, 2)}\n`);
console.log('Chat and internal read-only contract updated');
