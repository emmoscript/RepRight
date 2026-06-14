import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { installGlobalErrorHandler } from './src/lib/lastError';
import App from './App';

installGlobalErrorHandler();

registerRootComponent(App);
