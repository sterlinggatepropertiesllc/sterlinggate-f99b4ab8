import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignatureCanvas } from './SignatureCanvas';
import { Pencil, Type } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (signatureData: string | null, type: 'draw' | 'type') => void;
}

const SIGNATURE_FONTS = [
  { name: 'Brush Script MT', style: 'Brush Script MT, cursive' },
  { name: 'Lucida Handwriting', style: 'Lucida Handwriting, cursive' },
  { name: 'Segoe Script', style: 'Segoe Script, cursive' },
  { name: 'Comic Sans', style: 'Comic Sans MS, cursive' },
];

export function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);

  const handleTypedSignature = (name: string) => {
    setTypedName(name);
    if (name.trim()) {
      // Create a canvas to render the typed signature
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, 400, 150);
        ctx.font = `italic 48px ${selectedFont.style}`;
        ctx.fillStyle = 'hsl(220, 10%, 95%)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 200, 75);
        onSignatureChange(canvas.toDataURL('image/png'), 'type');
      }
    } else {
      onSignatureChange(null, 'type');
    }
  };

  const handleFontChange = (font: typeof SIGNATURE_FONTS[0]) => {
    setSelectedFont(font);
    if (typedName.trim()) {
      handleTypedSignature(typedName);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs 
        value={activeTab} 
        onValueChange={(v) => {
          setActiveTab(v as 'draw' | 'type');
          onSignatureChange(null, v as 'draw' | 'type');
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw" className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Type
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-4">
          <SignatureCanvas 
            onSignatureChange={(data) => onSignatureChange(data, 'draw')}
          />
        </TabsContent>

        <TabsContent value="type" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Type your full legal name</Label>
            <Input
              value={typedName}
              onChange={(e) => handleTypedSignature(e.target.value)}
              placeholder="Enter your name"
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Select font style</Label>
            <div className="grid grid-cols-2 gap-2">
              {SIGNATURE_FONTS.map((font) => (
                <button
                  key={font.name}
                  type="button"
                  onClick={() => handleFontChange(font)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedFont.name === font.name
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  style={{ fontFamily: font.style }}
                >
                  <span className="text-xl italic text-foreground">
                    {typedName || 'Preview'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {typedName && (
            <div className="p-6 rounded-lg border border-border bg-secondary/30">
              <p className="text-center text-muted-foreground text-sm mb-2">
                Your signature will appear as:
              </p>
              <p 
                className="text-4xl italic text-center text-foreground"
                style={{ fontFamily: selectedFont.style }}
              >
                {typedName}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
