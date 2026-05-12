import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

// Polimentos para a versão web (desktop + mobile browser)
if (Platform.OS === 'web') {
  // Remove o bounce scroll do iOS no body
  document.documentElement.style.overscrollBehavior = 'none';
  document.body.style.overscrollBehavior = 'none';

  // Cursor de ponteiro em elementos clicáveis
  const style = document.createElement('style');
  style.textContent = `
    /* Cursor pointer em botões e links */
    [role="button"], button, a { cursor: pointer; }

    /* Remove seleção de texto em elementos de UI */
    * { -webkit-tap-highlight-color: transparent; }

    /* Scrollbar discreta */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #BAE6FD; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #0EA5E9; }

    /* Fundo da página igual ao app */
    html, body { background-color: #F0F9FF; }
  `;
  document.head.appendChild(style);
}

registerRootComponent(App);
