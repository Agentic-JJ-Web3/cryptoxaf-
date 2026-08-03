// Crockford-ish alphabet: no 0/O or 1/I/L, so a reference read aloud or
// copied by hand doesn't collide with a lookalike character.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 4;

function generateOrderReference() {
  let suffix = '';
  for (let i = 0; i < LENGTH; i += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `CXF-${suffix}`;
}

module.exports = { generateOrderReference };
