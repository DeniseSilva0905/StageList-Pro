import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { 
  Save, 
  Globe, 
  Palette, 
  MousePointer2, 
  User as UserIcon, 
  LogOut, 
  RefreshCw,
  Upload,
  Trash2,
  Users,
  Phone,
  Instagram
} from 'lucide-react';
import { toast } from 'sonner';
import { User } from 'firebase/auth';

interface SettingsProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  user: User | null;
  onLogout: () => void;
  onResetData: () => Promise<void>;
}

export function Settings({ 
  settings, 
  setSettings, 
  user, 
  onLogout, 
  onResetData 
}: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLogoConfirm, setShowLogoConfirm] = useState(false);
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
    <div className="max-w-4xl mx-auto space-y-8 pb-20 font-sans">
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
                  <img src={user.photoURL} alt="User profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-widest leading-none">Logado como:</p>
                <p className="text-xl font-bold tracking-tight">
                  {user?.displayName || 'Usuário'}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">{user?.email}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Button 
                variant="outline" 
                onClick={onLogout}
                className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-white transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-6 cursor-pointer"
              >
                <LogOut className="h-3 w-3 mr-2" /> Sair
              </Button>
              <Button 
                onClick={onLogout}
                className="rounded-none border-primary text-primary border-2 hover:bg-primary hover:text-white transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-6 cursor-pointer"
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
              <Upload className="mr-3 h-4 w-4 text-primary" /> Logotipo da Equipe ou Banda
            </CardTitle>
            <CardDescription className="text-[11px] uppercase tracking-tight pt-1">
              Faça upload do logotipo da sua equipe ou banda para aparecer no cabeçalho dos relatórios em PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="h-32 w-32 border border-border bg-muted/20 flex items-center justify-center relative overflow-hidden group">
                {localSettings.bandLogo ? (
                  <img src={localSettings.bandLogo} alt="Logo da Banda" className="h-full w-full object-contain p-2" />
                ) : (
                  <div className="text-center p-4">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Sem Logo</p>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3 w-full sm:w-auto">
                <p className="text-xs text-muted-foreground">
                  Formatos recomendados: PNG ou JPG. Recomendado fundo transparente ou branco.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      const fileInput = document.getElementById('band-logo-upload') as HTMLInputElement;
                      if (fileInput) fileInput.click();
                    }}
                    className="rounded-none bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[10px] py-3 px-6 h-auto cursor-pointer"
                  >
                    Selecionar Imagem
                  </Button>
                  {localSettings.bandLogo && (
                    <>
                      {!showLogoConfirm ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowLogoConfirm(true)}
                          className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-white transition-all uppercase tracking-widest text-[10px] py-3 px-6 h-auto cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3 mr-2" /> Remover
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 border border-destructive/20 bg-destructive/5 p-2 rounded-sm animate-in fade-in duration-200">
                          <span className="text-[9px] uppercase tracking-wider text-destructive font-bold">Excluir logotipo?</span>
                          <Button
                            type="button"
                            onClick={() => {
                              setLocalSettings(prev => {
                                const updated = { ...prev };
                                delete updated.bandLogo;
                                return updated;
                              });
                              toast.success("Logotipo removido!");
                              setShowLogoConfirm(false);
                            }}
                            className="bg-destructive hover:bg-destructive/90 text-white uppercase text-[8px] tracking-widest px-2 py-1 h-auto cursor-pointer"
                          >
                            Sim
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setShowLogoConfirm(false)}
                            className="text-muted-foreground hover:bg-zinc-800 uppercase text-[8px] tracking-widest px-2 py-1 h-auto cursor-pointer"
                          >
                            Não
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <input
                  id="band-logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        setLocalSettings(prev => ({ ...prev, bandLogo: base64 }));
                        toast.success("Logotipo da banda carregado com sucesso!");
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-none">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center text-sm uppercase tracking-widest">
              <Users className="mr-3 h-4 w-4 text-primary" /> Informações da Equipe / Banda
            </CardTitle>
            <CardDescription className="text-[11px] uppercase tracking-tight pt-1">
              Insira as informações gerais da sua equipe ou banda para exibição no dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="bandName" className="text-[10px] uppercase tracking-widest font-bold">Nome da Banda ou Equipe</Label>
                <Input
                  id="bandName"
                  type="text"
                  placeholder="Ex: Banda Mirage"
                  value={localSettings.bandName || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, bandName: e.target.value })}
                  className="bg-background border-border rounded-none text-sm h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bandContact" className="text-[10px] uppercase tracking-widest font-bold">Contato para Shows</Label>
                <Input
                  id="bandContact"
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={localSettings.bandContact || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, bandContact: e.target.value })}
                  className="bg-background border-border rounded-none text-sm h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bandInstagram" className="text-[10px] uppercase tracking-widest font-bold">Instagram da Banda</Label>
                <Input
                  id="bandInstagram"
                  type="text"
                  placeholder="Ex: @bandamirage"
                  value={localSettings.bandInstagram || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, bandInstagram: e.target.value })}
                  className="bg-background border-border rounded-none text-sm h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bandMembers" className="text-[10px] uppercase tracking-widest font-bold">Integrantes e Instrumentos</Label>
                <Input
                  id="bandMembers"
                  type="text"
                  placeholder="Ex: João (Voz), Tiago (Guitarra), Lucas (Bateria)"
                  value={localSettings.bandMembers || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, bandMembers: e.target.value })}
                  className="bg-background border-border rounded-none text-sm h-11"
                />
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
                    className="w-16 p-1 h-10 bg-background border-border rounded-none cursor-pointer text-sm"
                  />
                  <Input 
                    type="text" 
                    value={localSettings.presentationBackground} 
                    readOnly 
                    className="flex-1 bg-background border-border rounded-none font-mono text-xs cursor-default text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="slideHeightCm" className="text-[10px] uppercase tracking-widest font-bold block mb-2">Altura do Slide ({localSettings.slideHeightCm || 15}cm)</Label>
                <div className="flex items-center space-x-4">
                  <span className="text-[9px] uppercase opacity-40 font-mono">10cm</span>
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
                  <span className="text-[9px] uppercase opacity-40 font-mono">30cm</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="pt-4 font-sans">
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest py-6 rounded-none transition-all cursor-pointer">
            <Save className="mr-2 h-4 w-4" /> Salvar Todas as Configurações
          </Button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="pt-12 border-t border-border mt-12">
        <h3 className="text-xl font-bold uppercase tracking-tight text-destructive flex items-center mb-6">
          <RefreshCw className="mr-2 h-5 w-5" /> Zona de Perigo
        </h3>
        
        <Card className="bg-destructive/5 border-destructive/20 rounded-none overflow-hidden font-sans">
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
                className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-white transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-8 cursor-pointer"
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
                    className="rounded-none bg-destructive hover:bg-destructive/90 text-white transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-8 font-bold cursor-pointer"
                  >
                    {isResetting ? 'APAGANDO...' : 'SIM, APAGAR AGORA'}
                  </Button>
                  <Button 
                    variant="ghost"
                    disabled={isResetting}
                    onClick={() => setShowResetConfirm(false)}
                    className="rounded-none hover:bg-muted transition-all uppercase tracking-widest text-[10px] h-auto py-3 px-8 cursor-pointer"
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
