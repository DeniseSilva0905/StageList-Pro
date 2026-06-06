/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useStorage } from './hooks/useStorage';
import { Library } from './components/Library';
import { Blocks } from './components/Blocks';
import { SetlistBuilder } from './components/SetlistBuilder';
import { RepertoireShows } from './components/RepertoireShows';
import { PresentationMode } from './components/PresentationMode';
import { Settings } from './components/Settings';
import { BlockExplorer } from './components/BlockExplorer';
import { SongEditor } from './components/SongEditor';
import { Song, Setlist } from './types';
import { Logo } from './components/Logo';
import { 
  Music, 
  Layers, 
  ListMusic, 
  Settings as SettingsIcon, 
  LayoutDashboard,
  PlayCircle,
  ExternalLink,
  Search as SearchIcon,
  Archive,
  Download,
  Menu,
  X,
  LogIn,
  LogOut,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Check,
  Monitor,
  Smartphone,
  Mail,
  Lock,
  Instagram,
  Users
} from 'lucide-react';
import { usePWA } from './hooks/usePWA';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { auth } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';

type View = 'dashboard' | 'library' | 'blocks' | 'explorer' | 'setlists' | 'repertoire' | 'settings' | 'edit-song';

export default function App() {
  const { 
    songs, setSongs, saveSong, deleteSong,
    blocks, setBlocks, saveBlock, deleteBlock,
    setlists, setSetlists, saveSetlist, deleteSetlist,
    settings, setSettings,
    clearBlocksAndSetlists,
    loading, user,
    isSyncing, lastSyncTime, triggerManualSync
  } = useStorage();

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [presentingSetlist, setPresentingSetlist] = useState<Setlist | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isSongEditorOpen, setIsSongEditorOpen] = useState(false);
  const [editSongReturnView, setEditSongReturnView] = useState<View>('library');
  const [initialEditSetlist, setInitialEditSetlist] = useState<Setlist | null>(null);
  const [comeFromRepertoire, setComeFromRepertoire] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const { isInstallable, installPWA, isIframe } = usePWA();

  // Integrated multi-channel auth states
  const [loginMethod, setLoginMethod] = useState<'google' | 'email-link' | 'password'>('google');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [emailLinkHandling, setEmailLinkHandling] = useState(false);

  // Parse and handle email verification link on launch or redirection callback
  useEffect(() => {
    const handleEmailLinkSignIn = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        setEmailLinkHandling(true);
        let email = window.localStorage.getItem('emailForSignIn') || '';
        if (!email) {
          const promptedEmail = window.prompt('Confirme seu e-mail do Google (Gmail) para concluir o login:');
          if (promptedEmail) {
            email = promptedEmail;
          }
        }
        if (email) {
          try {
            await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            toast.success("Acesso confirmado com sucesso! Seja bem-vindo à banda.");
          } catch (error: any) {
            console.error("Link auth failed:", error);
            toast.error("Erro ao validar o link de login: " + (error.message || "Link inválido ou expirado. Tente novamente."));
          } finally {
            setEmailLinkHandling(false);
          }
        } else {
          toast.error("Processo de e-mail cancelado. Forneça o e-mail de confirmação para logar.");
          setEmailLinkHandling(false);
        }
      }
    };
    handleEmailLinkSignIn();
  }, []);

  const handleManualSyncClick = async () => {
    try {
      await triggerManualSync();
      toast.success("Todos os dados foram sincronizados com sucesso na nuvem!");
    } catch (e) {
      toast.error("Erro ao sincronizar. Verifique sua conexão à internet.");
    }
  };

  const handleLogin = async () => {
    setAuthSubmitting(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
      toast.success("Login efetuado com sucesso via Google!");
    } catch (error: any) {
      console.error("Login failed:", error);
      toast.error("Falha no login com Google. Use a aba de e-mail se estiver no aplicativo baixado.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      toast.error("Por favor, informe seu e-mail.");
      return;
    }
    setAuthSubmitting(true);
    const actionCodeSettings = {
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    };
    try {
      await sendSignInLinkToEmail(auth, emailInput, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', emailInput);
      setEmailLinkSent(true);
      toast.success("Link de acesso enviado! Verifique sua caixa de entrada no e-mail.");
    } catch (error: any) {
      console.error("Error sending email link:", error);
      toast.error("Erro ao enviar confirmação de acesso: " + (error.message || error));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      toast.error("Por favor, preencha o e-mail e a senha.");
      return;
    }
    setAuthSubmitting(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        toast.success("Parabéns! Sua conta foi criada com sucesso e você está conectado.");
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        toast.success("Login efetuado com sucesso via e-mail e senha!");
      }
    } catch (error: any) {
      console.error("Email/Password auth error:", error);
      let errMsg = error.message;
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errMsg = "E-mail ou senha incorretos. Se este for seu primeiro acesso, ative a opção 'Criar nova conta' abaixo.";
      } else if (error.code === 'auth/email-already-in-use') {
        errMsg = "Este e-mail já possui uma conta ativa. Alterne para 'Entrar' ou recupere sua senha.";
      } else if (error.code === 'auth/weak-password') {
        errMsg = "A senha definida deve ter no mínimo 6 caracteres.";
      }
      toast.error(errMsg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailInput) {
      toast.error("Por favor, digite seu e-mail no campo acima primeiro.");
      return;
    }
    setAuthSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, emailInput);
      toast.success("E-mail de recuperação de senha enviado! Acesse seu e-mail para definir uma nova senha.");
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error("Erro ao enviar e-mail de recuperação: " + (error.message || error));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading || emailLinkHandling) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="text-muted-foreground uppercase tracking-widest text-xs">
          {emailLinkHandling ? 'Confirmando acesso por e-mail...' : 'Carregando Repertório...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8 text-center space-y-6">
        <div className="max-w-md w-full border border-border bg-card/60 p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          {/* Top aesthetic accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-cyan-400 to-[#39FF14]" />
          
          <div className="space-y-3">
            <Logo />
            <h1 className="text-2xl font-light uppercase tracking-widest text-white">StageList Pro</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
              Acesse seu acervo de músicas, blocos e setlists sincronizados de forma segura na nuvem.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-none border border-border/50">
            <button
              type="button"
              onClick={() => { setLoginMethod('google'); setEmailLinkSent(false); }}
              className={`py-3 text-[9px] uppercase font-bold tracking-wider transition-all rounded-none leading-none cursor-pointer ${
                loginMethod === 'google' 
                  ? 'bg-background text-primary border border-border/80 shadow-md font-black' 
                  : 'text-muted-foreground hover:text-white hover:bg-muted-foreground/5'
              }`}
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('email-link'); setEmailLinkSent(false); }}
              className={`py-3 text-[9px] uppercase font-bold tracking-wider transition-all rounded-none leading-none cursor-pointer ${
                loginMethod === 'email-link' 
                  ? 'bg-background text-[#39FF14] border border-border/80 shadow-md font-black' 
                  : 'text-muted-foreground hover:text-white hover:bg-muted-foreground/5'
              }`}
            >
              Link E-mail
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('password'); setEmailLinkSent(false); }}
              className={`py-3 text-[9px] uppercase font-bold tracking-wider transition-all rounded-none leading-none cursor-pointer ${
                loginMethod === 'password' 
                  ? 'bg-background text-yellow-400 border border-border/80 shadow-md font-black' 
                  : 'text-muted-foreground hover:text-white hover:bg-muted-foreground/5'
              }`}
            >
              E-mail + Senha
            </button>
          </div>

          {/* Form Content depending on tab */}
          <div className="space-y-4 pt-2">
            {loginMethod === 'google' && (
              <div className="space-y-5 py-4">
                <p className="text-xs text-muted-foreground leading-relaxed uppercase tracking-wider">
                  Recomendado para computadores, ou navegadores integrados de celular.
                </p>
                
                <Button 
                  onClick={handleLogin}
                  disabled={authSubmitting}
                  className="w-full rounded-none py-6 h-auto text-xs font-bold border-2 border-primary hover:bg-primary hover:text-white transition-all group shrink-0 cursor-pointer"
                >
                  {authSubmitting ? (
                    <Loader2 className="h-5 w-5 mr-3 animate-spin text-white" />
                  ) : (
                    <LogIn className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                  )}
                  ENTRAR COM GOOGLE
                </Button>
                
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 text-[9px] uppercase tracking-widest text-blue-400 leading-relaxed text-center">
                  ⚠️ NOTA DO APLICATIVO BAIXADO: Se estiver no aplicativo baixado e o Google exigir chave-senha (passkey) ou travar, use a aba acima <strong>"E-mail + Senha"</strong> para entrar com uma senha própria instantaneamente.
                </div>
              </div>
            )}

            {loginMethod === 'email-link' && (
              <div className="space-y-4 text-left">
                {emailLinkSent ? (
                  <div className="p-5 border border-[#39FF14]/30 bg-[#39FF14]/5 text-center space-y-4">
                    <div className="w-12 h-12 bg-[#39FF14]/10 rounded-full flex items-center justify-center mx-auto text-[#39FF14]">
                      <Mail className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">E-mail de confirmação enviado!</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest leading-relaxed">
                      Enviamos um link de login seguro para <strong className="text-white text-xs">{emailInput}</strong>.
                    </p>
                    <div className="p-3 bg-neutral-900 border border-border text-[9px] uppercase tracking-widest text-[#39FF14] font-semibold leading-relaxed">
                      💡 PRÓXIMO PASSO: Abra seu Gmail/Google Mail no dispositivo, abra nossa mensagem e clique no botão de confirmação. O aplicativo atualizará logado imediatamente nesta tela!
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={() => setEmailLinkSent(false)}
                      className="text-[10px] text-primary uppercase font-bold tracking-widest hover:underline pt-2 inline-block mx-auto text-center w-full cursor-pointer"
                    >
                      ← Alterar e-mail de envio
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSendEmailLink} className="space-y-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest text-center leading-relaxed">
                      Para o aplicativo baixado: Insira seu e-mail Google (preferencialmente Gmail) abaixo. Nós enviaremos um link de confirmação para aprovar seu acesso com um clique, sem usar chaves.
                    </p>
                    
                    <div className="space-y-1.5 pt-2">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">E-mail do Google (Gmail)</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="email"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="seu.email@gmail.com"
                          className="w-full bg-background border border-border px-10 py-3 text-xs focus:outline-none focus:border-[#39FF14] text-white placeholder-muted-foreground/60 rounded-none transition-colors"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full rounded-none py-5 h-auto text-xs font-bold bg-[#39FF14] text-black hover:bg-[#39FF14]/90 hover:shadow-[0_0_15px_rgba(57,255,20,0.3)] transition-all uppercase tracking-widest cursor-pointer"
                    >
                      {authSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin text-black" />
                          ENVIANDO CONFIRMAÇÃO...
                        </>
                      ) : (
                        "RECEBER CONFIRMAÇÃO NO E-MAIL"
                      )}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {loginMethod === 'password' && (
              <form onSubmit={handleEmailPasswordAuth} className="space-y-4 text-left">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest text-center leading-relaxed">
                  Insira seu e-mail e uma senha para acessar na hora. Se for sua primeira vez com e-mail/senha, marque "Criar nova conta" abaixo da senha.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="seu.email@gmail.com"
                        className="w-full bg-background border border-border px-10 py-3 text-xs focus:outline-none focus:border-yellow-400 text-white placeholder-muted-foreground/60 rounded-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">Senha</label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={authSubmitting}
                          className="text-[9px] text-[#39FF14] hover:underline uppercase tracking-wider cursor-pointer"
                        >
                          Esqueci a Senha
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder={isSignUp ? "Escolha uma senha (mín. 6 dígitos)" : "Digite sua senha de acesso"}
                        className="w-full bg-background border border-border px-10 py-3 text-xs focus:outline-none focus:border-yellow-400 text-white placeholder-muted-foreground/60 rounded-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="signUpToggle"
                    checked={isSignUp}
                    onChange={(e) => setIsSignUp(e.target.checked)}
                    className="h-3.5 w-3.5 border-border bg-background checked:bg-yellow-400 text-yellow-400 rounded-none focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="signUpToggle" className="text-[10px] uppercase font-semibold text-muted-foreground tracking-widest select-none cursor-pointer hover:text-white transition-colors">
                    Criar nova conta com esta senha
                  </label>
                </div>

                <Button 
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full rounded-none py-5 h-auto text-xs font-bold bg-yellow-400 text-black hover:bg-yellow-400/90 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all uppercase tracking-widest cursor-pointer"
                >
                  {authSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin text-black" />
                      {isSignUp ? "CONECTANDO E CADASTRANDO..." : "CONECTANDO..."}
                    </>
                  ) : (
                    isSignUp ? "CRIAR CONTA E ENTRAR" : "ENTRAR NO ACERVO"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">StageList Pro • Segurança direta por credenciais verificadas</p>
      </div>
    );
  }

  const presentSingleSong = (song: Song) => {
    const mockSetlist: Setlist = {
      id: 'mock-single-song',
      name: `Visualizando: ${song.title}`,
      items: [{ type: 'song', id: song.id }],
      createdAt: Date.now()
    };
    setPresentingSetlist(mockSetlist);
  };

  const handleEditSong = (song: Song | null, returnView: View = 'library') => {
    setEditingSong(song);
    setEditSongReturnView(returnView);
    setIsSongEditorOpen(true);
  };

  const handleSaveSong = (updatedSong: Song, closeAfterSave = true) => {
    saveSong(updatedSong);
    if (closeAfterSave) {
      setIsSongEditorOpen(false);
      setEditingSong(null);
    } else {
      setEditingSong(updatedSong);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="space-y-12">
            <div className="flex flex-col space-y-2">
              <h1 className="text-4xl font-light tracking-tight uppercase">Dashboard</h1>
              <div className="h-1 w-20 bg-primary"></div>
            </div>

            {/* Band / Team Hero Card */}
            <div className="p-6 md:p-8 border border-border bg-card/40 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 md:gap-8 rounded-none backdrop-blur-sm">
              <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-primary via-cyan-400 to-[#39FF14]" />
              
              {/* Logo Box */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 border border-border/80 bg-background/50 flex items-center justify-center p-2 relative overflow-hidden group shadow-lg">
                {settings.bandLogo ? (
                  <img src={settings.bandLogo} alt="Logo da Banda" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center space-y-1 p-2">
                    <Users className="h-6 w-6 text-primary mx-auto opacity-75" />
                    <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-black">StageList Pro</p>
                  </div>
                )}
              </div>

              {/* Band Info */}
              <div className="flex-1 text-center md:text-left space-y-4 w-full">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-widest font-black text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/20 px-2 py-0.5 inline-block">
                    Perfil da Banda/Equipe
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white leading-tight">
                    {settings.bandName || "Minha Banda / Equipe"}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 pt-3 border-t border-border/40 text-[11px] uppercase tracking-wider">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-muted-foreground font-extrabold block">Integrantes & Vozes</span>
                    <p className="text-zinc-200 font-bold truncate leading-relaxed">
                      {settings.bandMembers || "Ainda não definido nas configurações"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-muted-foreground font-extrabold block">Contato / Telefone</span>
                    <p className="text-zinc-200 font-bold truncate leading-relaxed">
                      {settings.bandContact || "Ainda não definido"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-muted-foreground font-extrabold block">Instagram</span>
                    {settings.bandInstagram ? (
                      <a 
                        href={`https://instagram.com/${settings.bandInstagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 font-bold hover:underline flex items-center justify-center md:justify-start gap-1"
                      >
                        <Instagram className="h-3.5 w-3.5 shrink-0" />
                        {settings.bandInstagram}
                      </a>
                    ) : (
                      <p className="text-zinc-400 italic font-bold">@instadabanda</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Config Button */}
              <div className="shrink-0 w-full md:w-auto self-stretch flex items-end justify-center md:justify-end">
                <Button 
                  onClick={() => setCurrentView('settings')}
                  className="rounded-none border-primary/30 hover:border-primary/80 text-primary border text-[9px] uppercase font-bold tracking-widest py-3 px-5 h-auto w-full md:w-auto select-none cursor-pointer bg-transparent hover:bg-primary/5 transition-all"
                >
                  CONFIGURAR BANDA
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-muted-foreground text-sm uppercase tracking-widest">Visão geral do sistema</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border border-border">
              <CardStat 
                title="Músicas" 
                value={songs.length} 
                icon={<Music className="h-4 w-4" />} 
                onClick={() => setCurrentView('library')}
              />
              <CardStat 
                title="Blocos" 
                value={blocks.length} 
                icon={<Layers className="h-4 w-4" />} 
                onClick={() => setCurrentView('blocks')}
              />
              <CardStat 
                title="Setlists" 
                value={setlists.length} 
                icon={<ListMusic className="h-4 w-4" />} 
                onClick={() => setCurrentView('repertoire')}
              />
              <CardStat 
                title="Duração Total" 
                value={formatTotalDuration(songs)} 
                icon={<PlayCircle className="h-4 w-4" />} 
                onClick={() => setCurrentView('library')}
              />
            </div>
          </div>

            {/* PWA Download Banner */}
            <div className="p-8 border border-border bg-card/40 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
              {/* Highlight bar inside banner */}
              <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.5)]"></div>
              
              <div className="flex items-center space-x-6 z-10 pl-2">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-none shrink-0 hidden sm:block">
                  <Download className="h-8 w-8 text-[#39FF14] drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-white flex items-center gap-2">
                    Instalar aplicativo no computador
                    {isInstallable && (
                      <span className="text-[10px] bg-[#39FF14] text-black px-1.5 py-0.5 font-bold tracking-widest uppercase rounded-sm animate-pulse">
                        Disponível
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1.5 leading-relaxed">
                    Instale o app na Área de Trabalho ou Tela de Início para acesso offline rápido e visualização em tela cheia com um clique.
                  </p>
                </div>
              </div>
              
              <Button 
                variant="ghost"
                onClick={() => setIsInstallModalOpen(true)}
                className="z-10 rounded-none px-8 py-6 h-auto font-black uppercase tracking-widest text-[10px] md:text-xs bg-[#39FF14] text-black hover:bg-[#39FF14]/90 hover:text-black transition-all shadow-[0_0_15px_rgba(57,255,20,0.25)] hover:shadow-[0_0_30px_rgba(57,255,20,0.55)] min-w-[200px]"
              >
                BAIXAR PROGRAMA
              </Button>
            </div>

            {settings.repertoireLink && (
              <div className="p-8 border border-border bg-card flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-none">
                    <ExternalLink className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold uppercase tracking-tight">Acervo Geral</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Acesse a pasta principal no Google Drive</p>
                  </div>
                </div>
                <Button variant="outline" className="rounded-none px-8 border-primary text-primary hover:bg-primary hover:text-white transition-all" nativeButton={false} render={
                  <a href={settings.repertoireLink} target="_blank" rel="noopener noreferrer">ABRIR DRIVE</a>
                } />
              </div>
            )}
          </div>
        );
      case 'library':
        return (
          <Library 
            songs={songs} 
            setSongs={setSongs} 
            deleteSong={deleteSong}
            blocks={blocks}
            onPresentSong={presentSingleSong} 
            onEditSong={handleEditSong}
          />
        );
      case 'edit-song':
        return null;
      case 'blocks':
        return <Blocks songs={songs} setSongs={setSongs} blocks={blocks} saveBlock={saveBlock} deleteBlock={deleteBlock} setBlocks={setBlocks} />;
      case 'explorer':
        return <BlockExplorer songs={songs} blocks={blocks} settings={settings} />;
      case 'setlists':
        return (
          <SetlistBuilder 
            songs={songs} 
            setSongs={setSongs}
            saveSong={saveSong}
            onEditSong={(song) => handleEditSong(song, 'setlists')}
            blocks={blocks} 
            setlists={setlists} 
            saveSetlist={saveSetlist}
            deleteSetlist={deleteSetlist}
            setSetlists={setSetlists} 
            onPresent={setPresentingSetlist}
            settings={settings}
            onUpdateSettings={setSettings}
            initialEditSetlist={initialEditSetlist}
            onClearInitialEditSetlist={() => setInitialEditSetlist(null)}
            onFinishedSaving={() => {
              if (comeFromRepertoire) {
                setCurrentView('repertoire');
                setComeFromRepertoire(false);
              }
            }}
            onCancel={() => {
              setInitialEditSetlist(null);
              if (comeFromRepertoire) {
                setCurrentView('repertoire');
                setComeFromRepertoire(false);
              } else {
                setCurrentView('repertoire');
              }
            }}
          />
        );
      case 'repertoire':
        return (
          <RepertoireShows
            songs={songs}
            blocks={blocks}
            setlists={setlists}
            deleteSetlist={deleteSetlist}
            setSetlists={setSetlists}
            onPresent={setPresentingSetlist}
            settings={settings}
            onEdit={(sl) => {
              setInitialEditSetlist(sl);
              setComeFromRepertoire(true);
              setCurrentView('setlists');
            }}
          />
        );
      case 'settings':
        return (
          <Settings 
            settings={settings} 
            setSettings={setSettings} 
            user={user} 
            onLogout={handleLogout} 
            onResetData={clearBlocksAndSetlists} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      {currentView !== 'edit-song' && (
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-40">
          <Logo />
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      )}

      {/* Sidebar */}
      {currentView !== 'edit-song' && (
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-[240px] border-r border-border bg-card flex flex-col transform transition-transform duration-300 ease-in-out h-full
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:sticky md:top-0 md:h-screen md:w-[220px] md:flex-shrink-0
        `}>
          <div className="p-6 border-b border-border hidden md:block">
            <Logo />
          </div>
          <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
            <NavItem 
              icon={<LayoutDashboard className="h-4 w-4" />} 
              label="Dashboard" 
              active={currentView === 'dashboard'} 
              onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }} 
            />
            <NavItem 
              icon={<Music className="h-4 w-4" />} 
              label="Biblioteca" 
              active={currentView === 'library'} 
              onClick={() => { setCurrentView('library'); setIsMobileMenuOpen(false); }} 
            />
            <NavItem 
              icon={<Layers className="h-4 w-4" />} 
              label="Blocos" 
              active={currentView === 'blocks'} 
              onClick={() => { setCurrentView('blocks'); setIsMobileMenuOpen(false); }} 
            />
            <NavItem 
              icon={<SearchIcon className="h-4 w-4" />} 
              label="Explorador" 
              active={currentView === 'explorer'} 
              onClick={() => { setCurrentView('explorer'); setIsMobileMenuOpen(false); }} 
            />
            <NavItem 
              icon={<ListMusic className="h-4 w-4" />} 
              label="Montar Show" 
              active={currentView === 'setlists'} 
              onClick={() => { setCurrentView('setlists'); setIsMobileMenuOpen(false); }} 
            />
            <NavItem 
              icon={<Archive className="h-4 w-4" />} 
              label="Repertório Shows" 
              active={currentView === 'repertoire'} 
              onClick={() => { setCurrentView('repertoire'); setIsMobileMenuOpen(false); }} 
            />
          </nav>
          <div className="p-4 border-t border-border space-y-1">
            <NavItem 
              icon={<Download className="h-4 w-4 text-[#39FF14]" />} 
              label="Instalar Aplicativo" 
              active={false} 
              onClick={() => { setIsInstallModalOpen(true); setIsMobileMenuOpen(false); }} 
              className={`text-[#39FF14] font-bold ${isInstallable ? 'animate-pulse' : ''}`}
            />
            
            {/* Sync Cloud Menu Item */}
            <Button
              variant="ghost"
              onClick={handleManualSyncClick}
              disabled={isSyncing}
              className="w-full justify-start rounded-none px-6 py-3.5 text-[13px] text-zinc-300 hover:text-white hover:bg-primary/5 group h-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-3 text-cyan-400 group-hover:scale-110 transition-transform shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <div className="text-left leading-normal">
                <div className="font-semibold text-zinc-200">Sincronizar Nuvem</div>
                <div className="text-[9px] text-muted-foreground uppercase mt-0.5">
                  {isSyncing ? "Sincronizando..." : lastSyncTime ? `Sync: ${lastSyncTime}` : "Sincronizar agora"}
                </div>
              </div>
            </Button>

            <NavItem 
              icon={<SettingsIcon className="h-4 w-4" />} 
              label="Configurações" 
              active={currentView === 'settings'} 
              onClick={() => { setCurrentView('settings'); setIsMobileMenuOpen(false); }} 
            />
            <NavItem 
              icon={<LogOut className="h-4 w-4 text-destructive" />} 
              label="Sair" 
              active={false} 
              onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
              className="text-destructive hover:bg-destructive/5 border-transparent"
            />
          </div>
        </aside>
      )}

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-auto">
        <div className={currentView === 'edit-song' ? 'flex-1' : 'flex-1 p-4 md:p-8'}>
          {renderView()}
        </div>
      </main>

      {/* Presentation Mode Overlay */}
      {presentingSetlist && (
        <PresentationMode 
          setlist={presentingSetlist}
          songs={songs}
          blocks={blocks}
          settings={settings}
          onUpdateSettings={setSettings}
          onClose={() => setPresentingSetlist(null)}
          onSaveSong={saveSong}
        />
      )}

      {/* Song Editor Overlay */}
      {isSongEditorOpen && (
        <div className="fixed inset-0 z-[60] bg-background">
          <SongEditor 
            song={editingSong} 
            songs={songs} 
            onSave={handleSaveSong} 
            onCancel={() => {
              setIsSongEditorOpen(false);
              setEditingSong(null);
            }} 
            settings={settings}
            onUpdateSettings={setSettings}
          />
        </div>
      )}

      {/* Guide to Install App Modal */}
      {isInstallModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop with elegant blur */}
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
            onClick={() => setIsInstallModalOpen(false)}
          />
          
          {/* Modal Container */}
          <div className="relative w-full max-w-2xl bg-[#0f0f12] border border-zinc-800 rounded-none shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden text-white flex flex-col max-h-[90vh] z-10">
            {/* Visual Accent Top Bar */}
            <div className="h-1.5 w-full bg-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.5)]" />
            
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-zinc-800/80 flex items-start justify-between">
              <div className="space-y-1">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  Instalar StageList Pro
                  <span className="text-[9px] bg-[#39FF14] text-black px-1.5 py-0.5 font-bold tracking-widest uppercase rounded-sm">
                    Recomendado
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 uppercase tracking-wider">Acesso offline integral no palco com visualizador nativo</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsInstallModalOpen(false)}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-none -mt-2 -mr-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Scrollable Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-sm text-zinc-300 leading-relaxed scrollbar-thin">
              
              {/* Why no .exe section */}
              <div className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-none flex items-start gap-4">
                <div className="p-3 bg-[#39FF14]/10 rounded-none shrink-0 border border-[#39FF14]/25 hidden sm:block">
                  <ShieldCheck className="h-6 w-6 text-[#39FF14] drop-shadow-[0_0_5px_rgba(57,255,20,0.3)]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs uppercase text-white tracking-wider">Por que não usamos um arquivo tradicional .exe?</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Arquivos <code className="text-[#39FF14] font-mono">.exe</code> de fontes desconhecidas representam riscos sérios de vírus/malware, exigem atualizações manuais tediosas e pesam o computador.
                  </p>
                  <p className="text-xs text-zinc-400 mt-2">
                    Nossa tecnologia <strong>Progressive Web App (PWA)</strong> permite a instalação direta pelo seu navegador em <strong>2 segundos de forma 100% segura</strong>, mantendo o programa levíssimo, com carregamento instantâneo offline e sincronização constante com a nuvem!
                  </p>
                </div>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-zinc-800/80 p-4 bg-zinc-950/40">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Check className="h-4 w-4 text-[#39FF14]" />
                    <span className="font-bold text-[10px] uppercase text-white tracking-widest">Modo Offline Total</span>
                  </div>
                  <p className="text-xs text-zinc-400">Trabalhe tocando no show sem depender de internet. Seus dados se salvam e sincronizam sozinhos ao reconectar.</p>
                </div>
                <div className="border border-zinc-800/80 p-4 bg-zinc-950/40">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Check className="h-4 w-4 text-[#39FF14]" />
                    <span className="font-bold text-[10px] uppercase text-white tracking-widest">Início Autônomo</span>
                  </div>
                  <p className="text-xs text-zinc-400">Abre com ícone próprio na sua Área de Trabalho sem barras de abas do navegador, simulando um programa nativo do PC.</p>
                </div>
              </div>

              {/* Steps walkthrough */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-widest text-[#39FF14] border-b border-zinc-800 pb-2">Passo a Passo de Instalação Manual</h3>
                
                <div className="space-y-4">
                  {/* Step 1: Desktop Chrome/Edge */}
                  <div className="flex gap-4">
                    <div className="font-mono text-zinc-500 font-extrabold text-sm w-5 shrink-0">01</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-zinc-400" />
                        <span className="font-semibold text-xs uppercase text-white tracking-wide">Computador (Chrome / Edge / Opera)</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Olhe no <strong>canto direito da barra de endereços</strong> do seu navegador (onde você digita o link do site, ao lado da estrela de favoritos). Clique no ícone de <strong>instalação de aplicativo</strong> (com aparência de monitor com setinha ou sinal de <code className="text-white">+</code>) e selecione <span className="text-[#39FF14] font-semibold">Instalar</span>.
                      </p>
                      
                      {/* Visual mock address bar */}
                      <div className="mt-3 p-2 bg-black border border-zinc-900/40 text-[11px] font-mono flex items-center justify-between text-zinc-500 w-full max-w-[450px]">
                        <div className="flex items-center gap-2 overflow-hidden truncate">
                          <span className="text-zinc-650 text-xs">🔒</span>
                          <span className="text-zinc-400 truncate">stagelist-pro-778648950267...</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 bg-zinc-900 border border-zinc-800/80 px-2 py-1 select-none animate-pulse text-[#39FF14] font-sans font-bold text-[9px] uppercase tracking-wider">
                          <span>⬇️</span>
                          <span>Instalar</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Safari on Mac */}
                  <div className="flex gap-4">
                    <div className="font-mono text-zinc-500 font-extrabold text-sm w-5 shrink-0">02</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-zinc-400" />
                        <span className="font-semibold text-xs uppercase text-white tracking-wide">Mac (Safari)</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        No navegador Safari do Mac, selecione o menu principal <strong className="text-white">Arquivo</strong> ou no botão <strong className="text-white">Compartilhar</strong> (ícone de quadrado com uma seta para cima) na parte superior direita e selecione <strong className="text-[#39FF14] font-semibold">Adicionar ao Dock</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Apple & Android Phones */}
                  <div className="flex gap-4">
                    <div className="font-mono text-zinc-500 font-extrabold text-sm w-5 shrink-0">03</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-zinc-400" />
                        <span className="font-semibold text-xs uppercase text-white tracking-wide">Celular ou Tablet (iPhone, iPad, Android)</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        No iPhone (Safari), clique no botão <strong className="text-white">Compartilhar</strong> (quadrado com seta para cima) e escolha <strong className="text-[#39FF14] font-semibold">Adicionar à Tela de Início</strong>. No Android (Chrome), clique no menu <strong className="text-white">⋮</strong> e selecione <strong className="text-[#39FF14] font-semibold">Instalar Aplicativo</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            {/* Footer Actions */}
            <div className="p-6 bg-zinc-900/30 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest text-center sm:text-left font-semibold">
                Tecnologia Oficial Progressive Web App (PWA)
              </p>
              <div className="flex gap-3 w-full sm:w-auto shrink-0">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const opened = await installPWA();
                    if (opened) {
                      setIsInstallModalOpen(false);
                      toast.success("Solicitação de instalação enviada!");
                    } else {
                      toast.error("Instalador automático não pôde ser chamado. Utilize o passo a passo manual indicado acima!");
                    }
                  }}
                  className="flex-1 sm:flex-none uppercase rounded-none bg-[#39FF14] hover:bg-[#39FF14]/90 hover:text-black text-black font-extrabold text-xs tracking-widest px-6 py-4 h-auto shadow-[0_0_15px_rgba(57,255,20,0.25)]"
                >
                  Instalar Automaticamente
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setIsInstallModalOpen(false)}
                  className="flex-1 sm:flex-none uppercase rounded-none border border-zinc-800 bg-[#0f0f12] text-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-700 font-extrabold text-xs tracking-widest px-6 py-4 h-auto"
                >
                  Fechar Manual
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}

function NavItem({ icon, label, active, onClick, className }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, className?: string }) {
  return (
    <Button 
      variant="ghost" 
      className={`w-full justify-start rounded-none px-6 py-6 text-[13px] transition-all ${
        active 
          ? "bg-primary/10 text-foreground border-l-4 border-primary font-semibold" 
          : "text-muted-foreground hover:text-foreground hover:bg-primary/5 border-l-4 border-transparent"
      } ${className || ''}`}
      onClick={onClick}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </Button>
  );
}

function CardStat({ title, value, icon, onClick }: { title: string, value: string | number, icon: React.ReactNode, onClick: () => void }) {
  return (
    <div 
      className="p-8 border-r border-border last:border-r-0 bg-card hover:bg-primary/5 transition-all cursor-pointer space-y-4 group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between text-muted-foreground group-hover:text-primary transition-colors">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{title}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold tracking-tighter">{value}</div>
    </div>
  );
}

function formatTotalDuration(songs: any[]) {
  const totalSeconds = songs.reduce((acc, song) => acc + song.duration, 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
