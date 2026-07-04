const ftp = require("basic-ftp");

async function example() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        console.log("Connecting using secure: 'implicit', port: 990...");
        await client.access({
            host: "10.1.209.27",
            user: "bblp",
            password: "f9d70bb1",
            secure: "implicit",
            port: 990,
            secureOptions: { rejectUnauthorized: false }
        });
        console.log("Implicit connection successful!");
        console.log(await client.list());
        
        // Let's try to download a file to test data socket session reuse
        console.log("Trying to list /cam...");
        const cam = await client.list('/cam');
        console.log("CAM:", cam);
    } catch (err) {
        console.log("Implicit failed:", err.message);
    }
    client.close();

    console.log("===============================");
    
    const client2 = new ftp.Client();
    client2.ftp.verbose = true;
    try {
        console.log("Connecting using secure: true (explicit), port: 21...");
        await client2.access({
            host: "10.1.209.27",
            user: "bblp",
            password: "f9d70bb1",
            secure: true,
            port: 21,
            secureOptions: { rejectUnauthorized: false }
        });
        console.log("Explicit connection successful!");
        console.log(await client2.list());
    } catch (err) {
        console.log("Explicit failed:", err.message);
    }
    client2.close();
}

example();
