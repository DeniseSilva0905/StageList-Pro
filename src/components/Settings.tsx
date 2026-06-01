import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Save, Globe, Palette, MousePointer2, User as UserIcon, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { User } from 'firebase/auth';

interface SettingsProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  user: User | null;
  onLogout: () => void;
  onResetData: () => Promise<void>;
}

export function Settings({ settings, setSettings, user, onLogout, onResetData }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSettings(localSettings);
    toast.success('Configurações salvas com sucesso!');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12 pb-20">
      <div className="flex flex-col space-y-2">
        <h2 className="text-4xl font-light tracking-tight uppercase">Configurações</h2>
        <div className="h-1 w-20 bg-primary"></div>
      </div>
      
      {/* Account Section */}
      <Card className="bg-card border-border rounded-none overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <CardTitle className="flex items-center text-sm uppercase tracking-widest">
            <UserIcon className="mr-3 h-4 w-4 text-primary" /> Conta do Usuário
          </CardTitle>
          <CardDescription className="text-[11px] uppercase tracking-tight pt-1">
            Informações sobre a conta conectada ao sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-primary/10 border border-primary/20 flex items-center justify-center">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User profile" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-widest leading-none">Logado como:</p>
                <p className="text-xl font-bold tracking-tight">{user?.displayName || 'Usuário'}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">{user?.email}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Button 
                variant="outline" 
                onClick={onLogout}
                className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-white transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-6"
              >
                <LogOut className="h-3 w-3 mr-2" /> Sair
              </Button>
              <Button 
                onClick={onLogout}
                className="rounded-none border-primary text-primary border-2 hover:bg-primary hover:text-white transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-6"
              >
                <RefreshCw className="h-3 w-3 mr-2" /> Trocar de Usuário
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <form onSubmit={handleSave} className="space-y-8">
        <Card className="bg-card border-border rounded-none">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center text-sm uppercase tracking-widest">
              <Globe className="mr-3 h-4 w-4 text-primary" /> Acervo Geral
            </CardTitle>
            <CardDescription className="text-[11px] uppercase tracking-tight pt-1">
              Link para a pasta ou planilha principal do acervo no Google Drive.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="repertoireLink" className="text-[10px] uppercase tracking-widest font-bold">Link do Acervo</Label>
              <Input 
                id="repertoireLink" 
                name="repertoireLink" 
                value={localSettings.repertoireLink} 
                onChange={(e) => setLocalSettings({ ...localSettings, repertoireLink: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="bg-background border-border rounded-none focus-visible:ring-primary"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-none">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center text-sm uppercase tracking-widest">
              <MousePointer2 className="mr-3 h-4 w-4 text-primary" /> Funcionalidades
            </CardTitle>
            <CardDescription className="text-[11px] uppercase tracking-tight pt-1">
              Habilite ou desabilite recursos extras de auxílio no palco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] uppercase tracking-widest font-bold block mb-2">Auto Rolagem (Letras)</Label>
                <div className="flex items-center bg-muted/40 rounded-md p-1 border border-border/50 max-w-fit">
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setLocalSettings({ ...localSettings, autoScroll: true })}
                    className={`h-7 px-4 text-[9px] uppercase font-bold tracking-[0.2em] rounded-sm transition-all ${localSettings.autoScroll ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                  >
                    Sim
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setLocalSettings({ ...localSettings, autoScroll: false })}
                    className={`h-7 px-4 text-[9px] uppercase font-bold tracking-[0.2em] rounded-sm transition-all ${!localSettings.autoScroll ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                  >
                    Não
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="scrollSpeed" className="text-[10px] uppercase tracking-widest font-bold block mb-2">Velocidade da Rolagem ({localSettings.scrollSpeed})</Label>
                <div className="flex items-center space-x-4">
                  <span className="text-[9px] uppercase opacity-40">Lento</span>
                  <input
                    id="scrollSpeed"
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={localSettings.scrollSpeed}
                    onChange={(e) => setLocalSettings({ ...localSettings, scrollSpeed: parseInt(e.target.value) })}
                    className="flex-1 accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[9px] uppercase opacity-40">Rápido</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-none">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center text-sm uppercase tracking-widest">
              <Palette className="mr-3 h-4 w-4 text-primary" /> Personalização do Show
            </CardTitle>
            <CardDescription className="text-[11px] uppercase tracking-tight pt-1">
              Ajuste as cores padrão para o modo de apresentação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label htmlFor="presentationBackground" className="text-[10px] uppercase tracking-widest font-bold">Cor de Fundo da Tela</Label>
                <div className="flex space-x-2">
                  <Input 
                    id="presentationBackground" 
                    name="presentationBackground" 
                    type="color" 
                    value={localSettings.presentationBackground}
                    onChange={(e) => setLocalSettings({ ...localSettings, presentationBackground: e.target.value })}
                    className="w-16 p-1 h-10 bg-background border-border rounded-none"
                  />
                  <Input 
                    type="text" 
                    value={localSettings.presentationBackground} 
                    readOnly 
                    className="flex-1 bg-background border-border rounded-none font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="slideHeightCm" className="text-[10px] uppercase tracking-widest font-bold block mb-2">Altura do Slide ({localSettings.slideHeightCm || 15}cm)</Label>
                <div className="flex items-center space-x-4">
                  <span className="text-[9px] uppercase opacity-40">10cm</span>
                  <input
                    id="slideHeightCm"
                    type="range"
                    min="10"
                    max="30"
                    step="1"
                    value={localSettings.slideHeightCm || 15}
                    onChange={(e) => setLocalSettings({ ...localSettings, slideHeightCm: parseInt(e.target.value) })}
                    className="flex-1 accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[9px] uppercase opacity-40">30cm</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="pt-4">
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest py-6 rounded-none transition-all">
            <Save className="mr-2 h-4 w-4" /> Salvar Todas as Configurações
          </Button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="pt-12 border-t border-border mt-12">
        <h3 className="text-xl font-bold uppercase tracking-tight text-destructive flex items-center mb-6">
          <RefreshCw className="mr-2 h-5 w-5" /> Zona de Perigo
        </h3>
        
        <Card className="bg-destructive/5 border-destructive/20 rounded-none overflow-hidden">
          <CardHeader className="border-b border-destructive/10">
            <CardTitle className="text-sm uppercase tracking-widest text-destructive">
              Resetar Blocos e Shows
            </CardTitle>
            <CardDescription className="text-[11px] uppercase tracking-tight pt-1">
              Esta ação apagará TODOS os seus blocos e setlists (shows) criados. Seu acervo de músicas NÃO será afetado.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {!showResetConfirm ? (
              <Button 
                variant="outline" 
                onClick={() => setShowResetConfirm(true)}
                className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-white transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-8"
              >
                APAGAR TUDO (MENOS MÚSICAS)
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-bold text-destructive uppercase tracking-widest">
                  VOCÊ TEM CERTEZA? ESSA AÇÃO É IRREVERSÍVEL.
                </p>
                <div className="flex gap-4">
                  <Button 
                    disabled={isResetting}
                    onClick={async () => {
                      setIsResetting(true);
                      try {
                        await onResetData();
                        toast.success('Reset concluído! Blocos e Shows foram apagados.');
                        setShowResetConfirm(false);
                      } catch (err) {
                        toast.error('Erro ao resetar: ' + (err instanceof Error ? err.message : String(err)));
                      } finally {
                        setIsResetting(false);
                      }
                    }}
                    className="rounded-none bg-destructive hover:bg-destructive/90 text-white transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-8 font-bold"
                  >
                    {isResetting ? 'APAGANDO...' : 'SIM, APAGAR AGORA'}
                  </Button>
                  <Button 
                    variant="ghost"
                    disabled={isResetting}
                    onClick={() => setShowResetConfirm(false)}
                    className="rounded-none hover:bg-muted transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-8"
                  >
                    CANCELAR
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
