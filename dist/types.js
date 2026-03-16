/**
 * Email channel plugin types.
 */
/** Anti-loop: addresses that must never receive auto-replies */
export const NOREPLY_PATTERNS = [
    /^no-?reply@/i,
    /^mailer-daemon@/i,
    /^postmaster@/i,
    /^bounce[sd]?[+-@]/i,
    /^notifications?@/i,
    /^noreply-/i,
    /^auto-/i,
];
/** Headers that indicate an auto-generated email (never reply) */
export const AUTO_REPLY_HEADERS = {
    "auto-submitted": ["auto-replied", "auto-generated", "auto-notified"],
    "x-auto-response-suppress": ["all", "oof", "dr", "rn", "nrn"],
    precedence: ["bulk", "junk", "list"],
};
//# sourceMappingURL=types.js.map