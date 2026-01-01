import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaseData {
  id: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  tenantName: string;
  landlordName: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  leaseType: string;
  terms: string;
  documentHash: string;
  signatures: {
    signerName: string;
    signedAt: string;
    ipAddress: string;
    hashId: string;
    signatureData: string;
  }[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { leaseId } = await req.json();

    if (!leaseId) {
      return new Response(
        JSON.stringify({ error: 'Lease ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch lease data with relations
    const { data: lease, error: leaseError } = await supabaseClient
      .from('leases')
      .select(`
        *,
        properties:property_id (address, city, state),
        tenant:tenant_id (full_name, email),
        manager:manager_id (full_name, email),
        signatures (signer_id, signed_at, ip_address, hash_id, signature_data, signature_type)
      `)
      .eq('id', leaseId)
      .single();

    if (leaseError || !lease) {
      console.error('Lease fetch error:', leaseError);
      return new Response(
        JSON.stringify({ error: 'Lease not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // First page - Lease content
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    let yPosition = height - 50;

    // Header
    page.drawText('COMMERCIAL LEASE AGREEMENT', {
      x: 50,
      y: yPosition,
      size: 18,
      font: timesBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    // Document info
    page.drawText(`Document ID: ${lease.id}`, {
      x: 50,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 15;

    if (lease.document_hash) {
      page.drawText(`Document Hash: ${lease.document_hash.substring(0, 32)}...`, {
        x: 50,
        y: yPosition,
        size: 8,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 30;
    }

    // Parties
    page.drawText('PARTIES', {
      x: 50,
      y: yPosition,
      size: 14,
      font: timesBold,
    });
    yPosition -= 20;

    page.drawText(`Landlord: ${lease.manager?.full_name || lease.manager?.email || 'N/A'}`, {
      x: 50,
      y: yPosition,
      size: 11,
      font: timesRoman,
    });
    yPosition -= 15;

    page.drawText(`Tenant: ${lease.tenant?.full_name || lease.tenant?.email || 'N/A'}`, {
      x: 50,
      y: yPosition,
      size: 11,
      font: timesRoman,
    });
    yPosition -= 30;

    // Property
    page.drawText('PREMISES', {
      x: 50,
      y: yPosition,
      size: 14,
      font: timesBold,
    });
    yPosition -= 20;

    const address = `${lease.properties?.address}, ${lease.properties?.city}, ${lease.properties?.state}`;
    page.drawText(address, {
      x: 50,
      y: yPosition,
      size: 11,
      font: timesRoman,
    });
    yPosition -= 30;

    // Term
    page.drawText('TERM', {
      x: 50,
      y: yPosition,
      size: 14,
      font: timesBold,
    });
    yPosition -= 20;

    page.drawText(`Start Date: ${new Date(lease.start_date).toLocaleDateString()}`, {
      x: 50,
      y: yPosition,
      size: 11,
      font: timesRoman,
    });
    yPosition -= 15;

    page.drawText(`End Date: ${new Date(lease.end_date).toLocaleDateString()}`, {
      x: 50,
      y: yPosition,
      size: 11,
      font: timesRoman,
    });
    yPosition -= 30;

    // Financial Terms
    page.drawText('FINANCIAL TERMS', {
      x: 50,
      y: yPosition,
      size: 14,
      font: timesBold,
    });
    yPosition -= 20;

    page.drawText(`Monthly Rent: $${Number(lease.monthly_rent).toLocaleString()}`, {
      x: 50,
      y: yPosition,
      size: 11,
      font: timesRoman,
    });
    yPosition -= 15;

    if (lease.security_deposit) {
      page.drawText(`Security Deposit: $${Number(lease.security_deposit).toLocaleString()}`, {
        x: 50,
        y: yPosition,
        size: 11,
        font: timesRoman,
      });
      yPosition -= 15;
    }
    yPosition -= 30;

    // Signatures page
    page = pdfDoc.addPage([612, 792]);
    yPosition = height - 50;

    page.drawText('SIGNATURES', {
      x: 50,
      y: yPosition,
      size: 18,
      font: timesBold,
    });
    yPosition -= 40;

    // Draw each signature
    if (lease.signatures && lease.signatures.length > 0) {
      for (const sig of lease.signatures) {
        const signerName = sig.signer_id === lease.tenant_id 
          ? (lease.tenant?.full_name || lease.tenant?.email || 'Tenant')
          : (lease.manager?.full_name || lease.manager?.email || 'Landlord');

        // Draw signature image if it's base64
        if (sig.signature_data && sig.signature_data.startsWith('data:image')) {
          try {
            const base64Data = sig.signature_data.split(',')[1];
            const signatureImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            
            const sigDims = signatureImage.scale(0.3);
            page.drawImage(signatureImage, {
              x: 50,
              y: yPosition - sigDims.height,
              width: sigDims.width,
              height: sigDims.height,
            });
            yPosition -= sigDims.height + 10;
          } catch (e) {
            console.error('Failed to embed signature image:', e);
          }
        }

        // Signature line
        page.drawLine({
          start: { x: 50, y: yPosition },
          end: { x: 300, y: yPosition },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        page.drawText(signerName, {
          x: 50,
          y: yPosition,
          size: 11,
          font: timesBold,
        });
        yPosition -= 15;

        page.drawText(`Signed: ${new Date(sig.signed_at).toLocaleString()}`, {
          x: 50,
          y: yPosition,
          size: 9,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 12;

        page.drawText(`IP: ${sig.ip_address || 'Not recorded'}`, {
          x: 50,
          y: yPosition,
          size: 9,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 12;

        page.drawText(`Hash: ${sig.hash_id.substring(0, 32)}...`, {
          x: 50,
          y: yPosition,
          size: 8,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 40;
      }
    } else {
      page.drawText('No signatures recorded yet.', {
        x: 50,
        y: yPosition,
        size: 11,
        font: timesRoman,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Footer on all pages
    const pages = pdfDoc.getPages();
    pages.forEach((p, idx) => {
      p.drawText(`Page ${idx + 1} of ${pages.length}`, {
        x: width / 2 - 30,
        y: 30,
        size: 9,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      if (lease.document_hash) {
        p.drawText(`Document Hash: ${lease.document_hash}`, {
          x: 50,
          y: 15,
          size: 7,
          font: helvetica,
          color: rgb(0.6, 0.6, 0.6),
        });
      }
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    console.log('PDF generated successfully for lease:', leaseId);

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="lease-${leaseId.substring(0, 8)}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('PDF generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
