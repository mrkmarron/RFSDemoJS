# DiagnosticsBuddy
A set of utilities to help manage diagnostic traces produced by NodeChakraCore. It uses an Azure link to [File Storage Share](https://azure.microsoft.com/en-us/services/storage/files) as a location to store traces and helps you to download/upload these traces to/from a local machine. 

The credential for accessing the Azure file share are represented as a json string of the form:
```
{
    "remoteShare": "[Share Name]",
    "remoteUser": "[User Name]",
    "storageKey": "[Storage Key]"
}
```
The credentials can be provided in two ways:
  1) Via the environment variable: `DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS`
  2) Via a config file, `azureconfig.json`, stored in the root directory of the project or application.

## Command line facilities
The DiagnosticBuddy utilities can be run as command line helpers via `app.js` which supports the following operations:
  * `--upload <trace> [--location <remotefile>]`   Process and upload the specified diagnostics trace `remotefile` or uses the trace name if no explicit location is provided.
  * `--download <remotefile> [--location <trace>]` Process and download the specified diagnostics trace `remotefile` and places the result in `trace` or into `./_tracelog` if no explicit location is provided.
  * `--remove <remotefile>` Remove the specified from the cloud if it exists.
  * `--list` List all of the remotefile traces currently in the cloud store.
  * `--compress <trace> [--location <localfile>]`  Compress the specified trace into the specified `localfile` or uses the `trace` name if no explicit location is provided.
  * `--decompress <localfile> [--location <trace>]`Decompress the specified `localfile` trace into the specified `trace` location or into `./_tracelog` if no explicit location is provided.

## TTD integration
The DiagnosticBuddy utilities can be `required` in your app to enable the automatic upload of TTD traces to a specified Azure file share.
`require(diagnostic-buddy).enableAzureUploads();`

