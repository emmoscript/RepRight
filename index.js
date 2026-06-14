import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { hydrateCrashDiag, installCrashDiagnostics } from './src/lib/crashDiag';
import App from './App';

installCrashDiagnostics();
void hydrateCrashDiag();

registerRootComponent(App);
