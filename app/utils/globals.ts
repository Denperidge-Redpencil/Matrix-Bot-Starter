export {};  // Declare file as module

declare global {
    // Only works with var, not with let/const
    var homeserverUrl : string;
    var clientId: string;
    var regexSelfMention: RegExp;
}
