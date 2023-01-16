/**
 * A function to be used to handle errors the same over the entire application.
 * This means that you don't have to rewrite logging code, and that you can change
 * the implementation of said logging easily
 * 
 * @param {any} err the error object provided by a catch 
 * 
 * @example promise.then(() => {...}).catch(LogError);
 * 
 */
export default function LogError(err: any) {
    console.log(err);
};

