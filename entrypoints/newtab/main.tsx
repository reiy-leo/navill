import { disableDevtoolsShortcuts, disableNativeContextMenu } from '@/src/ui/noNativeMenu';
import { mount } from '@/src/ui/mount';
import App from './App';

mount(<App />);
disableNativeContextMenu();
disableDevtoolsShortcuts();
