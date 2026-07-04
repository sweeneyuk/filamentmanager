const ftp = require("basic-ftp");

async function testConnection(mode, port, secureOptions = {}) {
    const client = new ftp.Client(5000); // 5 second timeout
    client.ftp.verbose = false;
    try {
        console.log(`\nTesting Mode: ${mode}, Port: ${port}, SecureOptions: ${JSON.stringify(secureOptions)}`);
        await client.access({
            host: "10.1.209.27",
            user: "bblp",
            password: "f9d70bb1",
            secure: mode === 'implicit' ? 'implicit' : true,
            port: port,
            secureOptions: secureOptions
        });
        console.log("SUCCESS! Connection established.");
        const list = await client.list('/');
        console.log(`Listed ${list.length} files in root.`);
        client.close();
        return true;
    } catch (err) {
        console.log(`FAILED: ${err.message}`);
        client.close();
        return false;
    }
}

async function runTests() {
    console.log("Starting Bambu FTP tests...");
    
    // Test 1: Implicit FTPS on port 990 (Standard)
    await testConnection('implicit', 990, { rejectUnauthorized: false });
    
    // Test 2: Explicit FTPS on port 21 (Sometimes Bambu uses this)
    await testConnection('explicit', 21, { rejectUnauthorized: false });
    
    // Test 3: Implicit FTPS on port 990 with custom cipher
    await testConnection('implicit', 990, { rejectUnauthorized: false, ciphers: 'DEFAULT:@SECLEVEL=0' });
    
    // Test 4: Explicit FTPS on port 21 with custom cipher
    await testConnection('explicit', 21, { rejectUnauthorized: false, ciphers: 'DEFAULT:@SECLEVEL=0' });
    
    console.log("\nTests complete.");
}

runTests();
