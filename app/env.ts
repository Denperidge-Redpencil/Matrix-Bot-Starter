import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();


export function getFromEnv(name : string) : string {
    let environmentVar : string = process.env[name] ?? '';
    if (environmentVar == '') {
        console.error(`${environmentVar} not set in .env`);
        console.error(`Exiting...`);
        process.exit(2);
    } else {
        return environmentVar;
    }
}
