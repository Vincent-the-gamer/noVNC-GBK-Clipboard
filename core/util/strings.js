/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 */

// Decode from UTF-8
export function decodeUTF8(utf8string, allowLatin1=false) {
    try {
        return decodeURIComponent(escape(utf8string));
    } catch (e) {
        if (e instanceof URIError) {
            if (allowLatin1) {
                // If we allow Latin1 we can ignore any decoding fails
                // and in these cases return the original string
                return utf8string;
            }
        }
        throw e;
    }
}

// Encode to UTF-8
export function encodeUTF8(DOMString) {
    return unescape(encodeURIComponent(DOMString));
}

// Encode to UTF-8, returning the raw bytes
export function encodeUTF8Bytes(DOMString) {
    const utf8string = encodeUTF8(DOMString);
    const bytes = new Uint8Array(utf8string.length);
    for (let i = 0; i < utf8string.length; i++) {
        bytes[i] = utf8string.charCodeAt(i);
    }
    return bytes;
}

// Lazily built lookup table for encoding to GB18030
let gb18030Table = null;

// Build a character -> byte sequence table for GB18030 by asking the
// browser's own decoder which byte sequences map to which characters.
// This avoids having to ship a large static table with the client.
function buildGB18030Table() {
    const decoder = new TextDecoder('gb18030', { fatal: true });
    const table = new Map();

    const addSequence = (bytes) => {
        let str;
        try {
            str = decoder.decode(Uint8Array.from(bytes));
        } catch {
            return; // Not a valid sequence for this encoding
        }
        // Only single characters are useful, and keep the first (usually
        // shortest) sequence found for a given character.
        if (str.length === 1 && !table.has(str)) {
            table.set(str, bytes);
        }
    };

    // Single byte sequences (ASCII)
    for (let b = 0x00; b <= 0x7f; b++) {
        addSequence([b]);
    }
    // Double byte sequences
    for (let lead = 0x81; lead <= 0xfe; lead++) {
        for (let trail = 0x40; trail <= 0xfe; trail++) {
            if (trail === 0x7f) {
                continue;
            }
            addSequence([lead, trail]);
        }
    }

    return table;
}

// Encode to GB18030 (a superset of GBK, which is what legacy Chinese
// Windows servers expect for the clipboard). Characters that cannot be
// represented are replaced with '?'.
export function encodeGB18030(DOMString) {
    if (typeof TextDecoder === 'undefined') {
        throw new Error('GB18030 encoding is not supported by this browser');
    }
    if (gb18030Table === null) {
        gb18030Table = buildGB18030Table();
    }

    const bytes = [];
    for (const char of DOMString) {
        const sequence = gb18030Table.get(char);
        if (sequence !== undefined) {
            bytes.push(...sequence);
        } else {
            bytes.push(0x3f); // '?'
        }
    }
    return new Uint8Array(bytes);
}

// Encode a string into raw bytes using the requested character set.
// Supported values are 'utf-8' (default) and 'gbk'/'gb18030'.
export function encodeText(DOMString, encoding) {
    switch (encoding) {
        case undefined:
        case null:
        case '':
        case 'utf-8':
        case 'utf8':
            return encodeUTF8Bytes(DOMString);

        case 'gbk':
        case 'gb18030':
            return encodeGB18030(DOMString);

        default:
            throw new Error(`Unsupported text encoding: ${encoding}`);
    }
}
