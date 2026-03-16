import { emailPlugin } from "./channel.js";
import { setEmailRuntime } from "./runtime.js";
const plugin = {
    id: "email",
    name: "Email",
    description: "Email channel plugin — IMAP IDLE inbound routing + SMTP outbound with thread awareness and anti-loop protection",
    register(api) {
        setEmailRuntime(api.runtime);
        api.registerChannel({ plugin: emailPlugin });
    },
};
export default plugin;
export { sendEmailReply, sendNewEmail } from "./send.js";
export { probeEmailAccount } from "./probe.js";
//# sourceMappingURL=index.js.map