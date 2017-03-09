# RFSDemoJS
A remote file server demo program for showing diagnostic traces and time-travel debugging features of Node-ChakraCore and VSCode. This application is a basic `express` powered server which supports browsing and previewing of the files/directories in the `testdata` folder on (listens on port 3000). 

To provide a bug for the demo the application will rename the file 'hello_world.js <-> helloWorld.js' in the background. This can result in an error around the call to `fs.readFile` and, if the application is being run with the `--record` flag, writing a diagnostic trace to disk. This trace can be debugged using VSCode and Node-ChakraCore's time-travel debugging features as described [here](https://aka.ms/NodeTTD).
