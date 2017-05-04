# RFSDemoJS
This repo contains a remote file server program for demonstating instantRepro diagnostic traces and time-travel debugging features of Node-ChakraCore and Visual Studio Code. This application is an `express` and `ejs` powered server which supports browsing and previewing files/directories in the `testdata` folder (and listens on port 3000). 

To provide a bug for the demo the application will rename the file 'hello_world.js <-> helloWorld.js' in the background. This can result in an error involving the call to `fs.readFile` when this file is selected for previewing.

## How to get started
To get started with instantRepro diagnostic tracing and Time-Travel Debugging you will need to do the following:

### Get Node-ChakraCore with instantRepro and Time-Travel Debugging
Install [NVS](https://github.com/jasongin/nvs/blob/master/README.md) which is a cross-platform tool for switching between different versions of Node.js and will allow you to easily switch between Node-ChakraCore and other Node.js versions. Once NVS is installed simply enter the following commands in the console:
```
nvs remote chakracore https://github.com/nodejs/node-chakracore/releases
nvs add chakracore/chakracore/8.0.0-pre2
nvs use chakracore/8.0.0-pre2
```

### Get Visual Studio Code
Install [VSCode](https://code.visualstudio.com/) using the latest installer.

### Get the RFSDemo Server
```
git clone https://github.com/mrkmarron/RFSDemoJS <appdir>
```

## Running the Application and Getting an instantRepro Trace
Start up the server, by default listents on `127.0.0.1`, in record mode:
```
cd <appdir> 
nvs run chakracore/8.0.0-pre2 --record index.js
```

To trigger the bug and produce the instantRepro diagnostic trace you can:
1. Open a browser window.
2. Navigate to `http://127.0.0.1:3000`
3. Click on `lorem.txt` - which will show the contents of the file successfully.
4. Click on `hello_world.js` -- which will return an error message to the browser and write an error message + write a error message to the command line.
5. On the command line `ctrl-c` to stop the server.

Since the application was run in `--record` mode an instantRepro diagnostic trace should be written to the subdirectory:
```
_diagnosticTraces\emitOnLogWarn_graceful-fs_line-78_column-13_bucket-0\trace-0
``` 
The location should be printed to console as well. 

To debug this trace launch Visual Studio Code and open the RFSDemo project/directory. If you open the debug launch configurations (`.vscode\launch.json`) you should see the following entry:
```
{
  "name": "replay",
  "type": "node",
  "protocol": "legacy",
  "request": "launch",
  "program": "${workspaceRoot}/.vscode/empty.js",
  "stopOnEntry": true,
  "windows": { "runtimeExecutable": "nvs.cmd" },
  "osx": { "runtimeExecutable": "nvs" },
  "linux": { "runtimeExecutable": "nvs" },
  "runtimeArgs": [
    "run",
    "chakracore/8.0.0-pre2",
    "--nolazy",
    "--break-first", 
    "--replay-debug=${workspaceRoot}/_diagnosticTraces/emitOnLogWarn_graceful-fs_line-78_column-13_bucket-0/trace-0"
  ],
  "console": "internalConsole"
}
```
This configuration will start executing the previously recorded instantRepro diagnostic trace, attach the debugger, and break at the first statement in the replayed execution. Hitting continue will resume execution until the program hits the explicit debugger statment associated with writing the error message to the console in the original recorded exection. In the `Call Stack` panel you can navigate the first `Anonymous Function` frame associated with `util.js line 99`. Inspecting the local variables you should see the `file_path` and `fileErrorTime` values match the values written to the console when the application was recorded.

To inspect the values of variables that existed when the callback was registered, such as `fileRequestTime` or `req.params.subpath`, you can set a breakpoint at `line 94` and hit the `Reverse` continue button. The program will travel back in time (reverse execute) back to this breakpoint allowing you to insepect these values. From here you can continue to single step back in time using the `Step Back` button as well.

Since the instantRepro diagnostics trace is guaranteed to execute the same way every time it is executed you can stop the debugger, set more breakpoints, and re-launch as many times as you like.  
