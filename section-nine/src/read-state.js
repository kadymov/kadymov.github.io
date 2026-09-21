const LIMIT = 1000;
const KEY = /^[0-9a-f]{8}$/;

export const freshReadState = () => ({ messages: [], choices: [] });

// A compact, deterministic fingerprint keeps dialogue text out of the save file.
export function readKey(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function messageKey(text) { return readKey(String(text)); }
export function choiceKey(id, node, text, choice) {
  return readKey(`${id}\u0000${node}\u0000${messageKey(text)}\u0000${choice.label}\u0000${choice.next ?? ''}`);
}

export function rememberRead(list, key) {
  if (list.includes(key)) return;
  list.push(key);
  if (list.length > LIMIT) list.shift();
}

export function validateReadState(raw = freshReadState()) {
  if (!raw || !Array.isArray(raw.messages) || !Array.isArray(raw.choices)
    || raw.messages.length > LIMIT || raw.choices.length > LIMIT
    || new Set(raw.messages).size !== raw.messages.length || new Set(raw.choices).size !== raw.choices.length
    || [...raw.messages, ...raw.choices].some(key => typeof key !== 'string' || !KEY.test(key))) {
    throw new Error('Повреждена история прочитанных реплик.');
  }
  return { messages: [...raw.messages], choices: [...raw.choices] };
}
