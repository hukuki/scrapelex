const { Mutex } = require('async-mutex');

const timeMutex = new Mutex();

async function safeReq(request, params, retryCount = 3, timeout = 1200000) {
    for (let i = 0; i < retryCount; i++) {
        try {
            await timeMutex.waitForUnlock();
            const response = await request(...params)
            return response;
        } catch (error) {
            console.log(error);
            console.log(`Retrying ${i}: ${params[0]}`)
            
            if (!timeMutex.isLocked()){
                await timeMutex.runExclusive(async () => {
                    await new Promise((resolve) => setTimeout(resolve, timeout));
                });
            }
        }
    }
}

module.exports = { safeReq };
