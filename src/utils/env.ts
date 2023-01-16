import * as dotenv from 'dotenv';

/**
 * Reloads the environment variables from .env
 */
export function loadConfig() : void {
    dotenv.config();
}

/**
 * Get an environment variable, exiting 
 * 
 * @param name - The name of the environment variable
 * @param {boolean} [allowEmpty=false] - When set to true, overrides the exit behaviour, instead returning an empty string if undefined
 * @returns {string} The value of the environment variable
 */
export function getFromEnv(name : string, allowEmpty : boolean=false) : string {
    let environmentVar : string = process.env[name] ?? '';
    if (environmentVar == '') {
        if (allowEmpty) return '';
        console.error(`${name} not set in .env`);
        console.error(`Exiting...`);
        process.exit(2);
    } else {
        return environmentVar;
    }
}

