import { getFromEnv, loadConfig } from './utils/env';

declare global {
    // Only works with var, not with let/const
    var homeserverUrl : string;
    var clientId: string;
    var regexSelfMention: RegExp;
}


