import * as dotenv from 'dotenv';

export function loadConfig() {
    dotenv.config();
}

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

// Load .env file
loadConfig();
