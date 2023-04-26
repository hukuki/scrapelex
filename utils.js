const { Mutex } = require('async-mutex');
const fetch = require('node-fetch');
const HttpsProxyAgent = require('https-proxy-agent');

const timeMutex = new Mutex();

async function getProxy() {
    for (let i = 0; i < 20; i++) {
        const proxy = await fetch("http://localhost:8000/random");
        const proxy_string = (await proxy.json())[0];
        if (proxy_string)
            return proxy_string;
        console.log("No proxy found, retrying in 10 seconds", i)
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }
}

async function deleteProxy(proxy) {
    const ip = proxy.split("@")[1].split(":")[0];
    await fetch("http://localhost:8000/destroy?ip_address="+ ip, { method: 'DELETE', headers: {"accept" : "application/json"}} );
}

async function safeReq(url, params, resType, retryCount = 3, timeout = 20000) {
    for (let i = 0; i < retryCount; i++) {
        await timeMutex.waitForUnlock();
        const proxy = await getProxy();
        const proxyAgent = new HttpsProxyAgent(proxy);
        try {
            let response = await fetch(url, {...params, agent: proxyAgent});
            const resBody = await response[resType]();
            response.data = resBody;
            return response;
        } catch (error) {
            console.log(error);
            console.log(`Retrying ${i}: ${url}`)
            deleteProxy(proxy)
            
            if (!timeMutex.isLocked()){
                await timeMutex.runExclusive(async () => {
                    await new Promise((resolve) => setTimeout(resolve, timeout));
                });
            }
        }
    }
}

module.exports = { safeReq };