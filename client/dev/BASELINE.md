# Baseline at 5817f82

## npm run lint (38 warnings, 0 errors)
```
lint exit 0
```

## npm run build
```
dist/assets/index-DedAJxng.css   11.05 kB │ gzip:   2.79 kB
dist/assets/index-Cxhjt8fu.js   923.93 kB │ gzip: 279.05 kB
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 736ms
PWA v1.3.0
mode      generateSW
precache  7 entries (914.09 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
build exit 0
```

Full lint warnings:
```
src/components/Archive.jsx:5:54: warning eslint(no-unused-vars): Identifier 'Scale' is imported but never used. help: Consider removing this import.
src/components/Archive.jsx:5:61: warning eslint(no-unused-vars): Identifier 'Banknote' is imported but never used. help: Consider removing this import.
src/components/Archive.jsx:10:10: warning eslint(no-unused-vars): Variable 'loading' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/components/Archive.jsx:10:19: warning eslint(no-unused-vars): Variable 'setLoading' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/components/Archive.jsx:466:68: warning eslint(no-unused-vars): Catch parameter 'e' is caught but never used. help: Consider handling this error.
src/components/Jobs.jsx:43:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/Jobs.jsx:64:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/Jobs.jsx:34:5: warning react-hooks(exhaustive-deps): React Hook useEffect has a missing dependency: 'fetchJobs' help: Either include it or remove the dependency array.
src/components/SpoolModal.jsx:113:18: warning eslint(no-unused-vars): Catch parameter 'e' is caught but never used. help: Consider handling this error.
src/components/SpoolModal.jsx:127:16: warning eslint(no-unused-vars): Catch parameter 'e' is caught but never used. help: Consider handling this error.
src/components/SpoolModal.jsx:172:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/SpoolModal.jsx:61:37: warning react-hooks(exhaustive-deps): React Hook useEffect has a missing dependency: 'lookupKnowledge' help: Either include it or remove the dependency array.
src/components/PrintersManagement.jsx:79:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/PrintersManagement.jsx:30:5: warning react-hooks(exhaustive-deps): React Hook useEffect has a missing dependency: 'fetchPrinters' help: Either include it or remove the dependency array.
src/contexts/AlertContext.jsx:5:14: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
src/contexts/SocketContext.jsx:7:14: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
src/contexts/SocketContext.jsx:15:11: warning react-hooks(exhaustive-deps): React Hook useEffect has a missing dependency: 'socket' help: Either include it or remove the dependency array.
src/contexts/AuthContext.jsx:6:14: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
src/components/FilamentManager.jsx:17:10: warning eslint(no-unused-vars): Variable 'amsData' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/components/FilamentManager.jsx:126:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FilamentManager.jsx:129:9: warning eslint(no-unused-vars): Variable 'handleAssignAms' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/components/FilamentManager.jsx:133:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FilamentManager.jsx:144:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FilamentManager.jsx:164:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FilamentManager.jsx:174:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FilamentManager.jsx:189:18: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FilamentManager.jsx:199:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FilamentManager.jsx:214:18: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FilamentManager.jsx:251:9: warning eslint(no-unused-vars): Variable 'restockSpools' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/components/Login.jsx:58:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/FloatingAssistant.jsx:39:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/Settings.jsx:63:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/Settings.jsx:75:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/PrintStatus.jsx:111:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/PrintStatus.jsx:124:18: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/PrintStatus.jsx:135:14: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/components/PrintStatus.jsx:524:32: warning eslint(no-unused-vars): Catch parameter 'e' is caught but never used. help: Consider handling this error.
src/components/PrintStatus.jsx:41:7: warning react-hooks(exhaustive-deps): React Hook useEffect has a missing dependency: 'showAlert' help: Either include it or remove the dependency array.
```
