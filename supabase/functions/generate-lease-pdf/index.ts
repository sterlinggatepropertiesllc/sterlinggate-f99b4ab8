import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Compute SHA-256 hash from binary data
async function computeSHA256(data: Uint8Array): Promise<string> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { leaseId, certificateOnly = false, includeCertificate = true } = await req.json();

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

    const landlordName = lease.manager?.full_name || lease.manager?.email || 'Landlord';
    const tenantName = lease.tenant?.full_name || lease.tenant?.email || 'Tenant';
    const landlordSig = lease.signatures?.find((s: any) => s.signer_id === lease.manager_id);
    const tenantSig = lease.signatures?.find((s: any) => s.signer_id === lease.tenant_id);

    // If only certificate is requested, generate certificate PDF
    if (certificateOnly) {
      const certPdf = await generateCertificatePDF(
        lease, 
        landlordName, 
        tenantName, 
        landlordSig, 
        tenantSig,
        lease.document_hash // Use existing hash for standalone certificate
      );
      
      console.log('Certificate PDF generated for lease:', leaseId);
      
      return new Response(certPdf as unknown as BodyInit, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="certificate-${leaseId.substring(0, 8)}.pdf"`,
        },
      });
    }

    // STEP 1: Generate the main lease PDF (without certificate page)
    const mainLeasePdf = await generateMainLeasePDF(lease, landlordName, tenantName, landlordSig, tenantSig);
    
    // STEP 2: Compute SHA-256 hash from the actual PDF binary
    const mainPdfBytes = await mainLeasePdf.save();
    const documentHash = await computeSHA256(mainPdfBytes);
    
    console.log('Computed document hash:', documentHash);

    // STEP 3: Update the lease record with the final hash
    await supabaseClient
      .from('leases')
      .update({ document_hash: documentHash })
      .eq('id', leaseId);

    // STEP 4: If includeCertificate, append certificate as final page
    let finalPdfBytes: Uint8Array;
    
    if (includeCertificate && lease.signatures && lease.signatures.length > 0) {
      // Reload the main PDF and add the certificate page with the final hash
      const finalPdf = await PDFDocument.load(mainPdfBytes);
      await appendCertificatePage(
        finalPdf,
        lease,
        landlordName,
        tenantName,
        landlordSig,
        tenantSig,
        documentHash
      );
      finalPdfBytes = await finalPdf.save();
    } else {
      finalPdfBytes = mainPdfBytes;
    }

    console.log('PDF generated successfully for lease:', leaseId);

    return new Response(finalPdfBytes as unknown as BodyInit, {
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

// Generate the main lease document PDF
async function generateMainLeasePDF(
  lease: any,
  landlordName: string,
  tenantName: string,
  landlordSig: any,
  tenantSig: any
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const addNewPage = () => {
    const newPage = pdfDoc.addPage([612, 792]);
    return { page: newPage, yPosition: 742 };
  };

  let pageData = addNewPage();
  let page = pageData.page;
  let yPosition = pageData.yPosition;

  // Header
  page.drawText('COMMERCIAL LEASE AGREEMENT', {
    x: 50,
    y: yPosition,
    size: 18,
    font: timesBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;

  // Document ID
  page.drawText(`Document ID: ${lease.id}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  yPosition -= 20;

  page.drawText(`Created: ${formatDateShort(lease.created_at)}`, {
    x: 50,
    y: yPosition,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  yPosition -= 30;

  // Parties
  page.drawText('PARTIES', {
    x: 50,
    y: yPosition,
    size: 14,
    font: timesBold,
  });
  yPosition -= 20;

  page.drawText(`Landlord: ${landlordName}`, {
    x: 50,
    y: yPosition,
    size: 11,
    font: timesRoman,
  });
  yPosition -= 15;

  page.drawText(`Tenant: ${tenantName}`, {
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

  page.drawText(`Start Date: ${formatDateShort(lease.start_date)}`, {
    x: 50,
    y: yPosition,
    size: 11,
    font: timesRoman,
  });
  yPosition -= 15;

  page.drawText(`End Date: ${formatDateShort(lease.end_date)}`, {
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
  yPosition -= 20;

  // Full Lease Terms
  if (lease.terms) {
    page.drawText('LEASE TERMS AND CONDITIONS', {
      x: 50,
      y: yPosition,
      size: 14,
      font: timesBold,
    });
    yPosition -= 25;

    const termsLines = lease.terms.split('\n');
    const maxWidth = 512;

    for (const line of termsLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        yPosition -= 10;
        continue;
      }

      const isHeader = trimmedLine.startsWith('ARTICLE') ||
        trimmedLine.startsWith('SECTION') ||
        (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length < 60);
      const font = isHeader ? timesBold : timesRoman;
      const fontSize = isHeader ? 12 : 10;

      const words = trimmedLine.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > maxWidth && currentLine) {
          if (yPosition < 60) {
            const newPageData = addNewPage();
            page = newPageData.page;
            yPosition = newPageData.yPosition;
          }

          page.drawText(currentLine, {
            x: 50,
            y: yPosition,
            size: fontSize,
            font: font,
          });
          yPosition -= fontSize + 4;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        if (yPosition < 60) {
          const newPageData = addNewPage();
          page = newPageData.page;
          yPosition = newPageData.yPosition;
        }

        page.drawText(currentLine, {
          x: 50,
          y: yPosition,
          size: fontSize,
          font: font,
        });
        yPosition -= fontSize + (isHeader ? 8 : 4);
      }
    }
  }
  yPosition -= 20;

  // Signatures Page
  const sigPageData = addNewPage();
  page = sigPageData.page;
  yPosition = sigPageData.yPosition;

  page.drawText('SIGNATURES', {
    x: 50,
    y: yPosition,
    size: 18,
    font: timesBold,
  });
  yPosition -= 10;

  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: 562, y: yPosition },
    thickness: 2,
    color: rgb(0, 0, 0),
  });
  yPosition -= 40;

  if (lease.signatures && lease.signatures.length > 0) {
    const drawSignatureBlock = async (
      sig: any,
      role: string,
      name: string,
      xOffset: number
    ) => {
      let localY = yPosition;

      page.drawText(role.toUpperCase() + ':', {
        x: xOffset,
        y: localY,
        size: 10,
        font: timesBold,
        color: rgb(0.3, 0.3, 0.3),
      });
      localY -= 20;

      if (sig.signature_data && sig.signature_data.startsWith('data:image')) {
        try {
          const base64Data = sig.signature_data.split(',')[1];
          const signatureImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

          const maxWidth = 180;
          const maxHeight = 60;
          let sigWidth = signatureImage.width;
          let sigHeight = signatureImage.height;

          if (sigWidth > maxWidth) {
            const ratio = maxWidth / sigWidth;
            sigWidth = maxWidth;
            sigHeight = sigHeight * ratio;
          }
          if (sigHeight > maxHeight) {
            const ratio = maxHeight / sigHeight;
            sigHeight = maxHeight;
            sigWidth = sigWidth * ratio;
          }

          page.drawImage(signatureImage, {
            x: xOffset,
            y: localY - sigHeight,
            width: sigWidth,
            height: sigHeight,
          });
          localY -= sigHeight + 5;
        } catch (e) {
          console.error('Failed to embed signature image:', e);
          localY -= 30;
        }
      } else {
        localY -= 30;
      }

      page.drawLine({
        start: { x: xOffset, y: localY },
        end: { x: xOffset + 200, y: localY },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      localY -= 15;

      page.drawText(name, {
        x: xOffset,
        y: localY,
        size: 11,
        font: timesBold,
      });
      localY -= 18;

      page.drawText(`Date: ${formatDateShort(sig.signed_at)}`, {
        x: xOffset,
        y: localY,
        size: 10,
        font: timesRoman,
      });
      localY -= 14;

      page.drawText(`IP: ${sig.ip_address || 'Not recorded'}`, {
        x: xOffset,
        y: localY,
        size: 8,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      localY -= 12;

      page.drawText(`Signature Hash: ${sig.hash_id.substring(0, 24)}...`, {
        x: xOffset,
        y: localY,
        size: 7,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      return localY;
    };

    if (landlordSig) {
      await drawSignatureBlock(landlordSig, 'Landlord', landlordName, 50);
    }

    if (tenantSig) {
      await drawSignatureBlock(tenantSig, 'Tenant', tenantName, 320);
    }

    yPosition -= 180;
  } else {
    page.drawText('No signatures recorded yet.', {
      x: 50,
      y: yPosition,
      size: 11,
      font: timesRoman,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  // Add page numbers
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(`Page ${idx + 1} of ${pages.length}`, {
      x: 306 - 30,
      y: 30,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return pdfDoc;
}

// Append Certificate of Completion page to existing PDF
async function appendCertificatePage(
  pdfDoc: PDFDocument,
  lease: any,
  landlordName: string,
  tenantName: string,
  landlordSig: any,
  tenantSig: any,
  documentHash: string
): Promise<void> {
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const page = pdfDoc.addPage([612, 792]);
  let y = 742;

  // Certificate Header with border
  page.drawRectangle({
    x: 40,
    y: 680,
    width: 532,
    height: 80,
    borderColor: rgb(0, 0.3, 0.6),
    borderWidth: 3,
  });

  page.drawText('CERTIFICATE OF COMPLETION', {
    x: 140,
    y: 730,
    size: 22,
    font: helveticaBold,
    color: rgb(0, 0.2, 0.5),
  });

  page.drawText('Electronic Signature Verification', {
    x: 200,
    y: 700,
    size: 12,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  y = 650;

  // Document Information Section
  page.drawText('DOCUMENT INFORMATION', {
    x: 50,
    y: y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  y -= 5;

  page.drawLine({
    start: { x: 50, y: y },
    end: { x: 562, y: y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  page.drawText('Document ID:', { x: 50, y: y, size: 10, font: helveticaBold });
  page.drawText(lease.id, { x: 150, y: y, size: 10, font: helvetica });
  y -= 16;

  page.drawText('Document Type:', { x: 50, y: y, size: 10, font: helveticaBold });
  page.drawText('Commercial Lease Agreement', { x: 150, y: y, size: 10, font: helvetica });
  y -= 16;

  page.drawText('Property:', { x: 50, y: y, size: 10, font: helveticaBold });
  const propertyAddr = `${lease.properties?.address}, ${lease.properties?.city}, ${lease.properties?.state}`;
  page.drawText(propertyAddr, { x: 150, y: y, size: 10, font: helvetica });
  y -= 16;

  page.drawText('Created:', { x: 50, y: y, size: 10, font: helveticaBold });
  page.drawText(formatDate(lease.created_at), { x: 150, y: y, size: 10, font: helvetica });
  y -= 16;

  page.drawText('Completed:', { x: 50, y: y, size: 10, font: helveticaBold });
  const completedDate = tenantSig?.signed_at || landlordSig?.signed_at || new Date().toISOString();
  page.drawText(formatDate(completedDate), { x: 150, y: y, size: 10, font: helvetica });
  y -= 30;

  // SHA-256 Hash Section
  page.drawRectangle({
    x: 45,
    y: y - 45,
    width: 522,
    height: 55,
    color: rgb(0.95, 0.95, 0.98),
    borderColor: rgb(0.7, 0.7, 0.8),
    borderWidth: 1,
  });

  page.drawText('DOCUMENT SHA-256 HASH', {
    x: 50,
    y: y - 5,
    size: 10,
    font: helveticaBold,
    color: rgb(0, 0.2, 0.5),
  });

  // Split hash into two lines for readability
  const hashLine1 = documentHash.substring(0, 32);
  const hashLine2 = documentHash.substring(32);
  
  page.drawText(hashLine1, {
    x: 55,
    y: y - 22,
    size: 9,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText(hashLine2, {
    x: 55,
    y: y - 34,
    size: 9,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 70;

  // Signer Information Section
  page.drawText('SIGNER INFORMATION', {
    x: 50,
    y: y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  y -= 5;

  page.drawLine({
    start: { x: 50, y: y },
    end: { x: 562, y: y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  // Landlord Signer
  page.drawRectangle({
    x: 45,
    y: y - 80,
    width: 250,
    height: 90,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  page.drawText('LANDLORD', { x: 55, y: y - 5, size: 10, font: helveticaBold, color: rgb(0, 0.3, 0.6) });
  page.drawText(`Name: ${landlordName}`, { x: 55, y: y - 22, size: 9, font: helvetica });
  
  if (landlordSig) {
    page.drawText(`Signed: ${formatDate(landlordSig.signed_at)}`, { x: 55, y: y - 36, size: 9, font: helvetica });
    page.drawText(`IP Address: ${landlordSig.ip_address || 'Not recorded'}`, { x: 55, y: y - 50, size: 9, font: helvetica });
    page.drawText(`Signature Hash:`, { x: 55, y: y - 64, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(`${landlordSig.hash_id.substring(0, 32)}...`, { x: 55, y: y - 76, size: 7, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
  } else {
    page.drawText('Not yet signed', { x: 55, y: y - 36, size: 9, font: helvetica, color: rgb(0.6, 0.3, 0.3) });
  }

  // Tenant Signer
  page.drawRectangle({
    x: 310,
    y: y - 80,
    width: 250,
    height: 90,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  page.drawText('TENANT', { x: 320, y: y - 5, size: 10, font: helveticaBold, color: rgb(0, 0.3, 0.6) });
  page.drawText(`Name: ${tenantName}`, { x: 320, y: y - 22, size: 9, font: helvetica });
  
  if (tenantSig) {
    page.drawText(`Signed: ${formatDate(tenantSig.signed_at)}`, { x: 320, y: y - 36, size: 9, font: helvetica });
    page.drawText(`IP Address: ${tenantSig.ip_address || 'Not recorded'}`, { x: 320, y: y - 50, size: 9, font: helvetica });
    page.drawText(`Signature Hash:`, { x: 320, y: y - 64, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(`${tenantSig.hash_id.substring(0, 32)}...`, { x: 320, y: y - 76, size: 7, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
  } else {
    page.drawText('Not yet signed', { x: 320, y: y - 36, size: 9, font: helvetica, color: rgb(0.6, 0.3, 0.3) });
  }

  y -= 110;

  // Binding Statement Section
  page.drawText('CERTIFICATION STATEMENT', {
    x: 50,
    y: y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  y -= 5;

  page.drawLine({
    start: { x: 50, y: y },
    end: { x: 562, y: y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  const bindingStatement = [
    "I hereby certify that this document has been electronically signed by all parties",
    "indicated above. The SHA-256 cryptographic hash displayed on this certificate was",
    "computed from the final, immutable PDF binary of the signed lease agreement.",
    "",
    "This hash serves as a unique digital fingerprint that can be used to verify the",
    "authenticity and integrity of this document. Any modification to the document",
    "content would result in a different hash value.",
    "",
    "The electronic signatures contained in this document are legally binding and",
    "enforceable under applicable electronic signature laws, including the Electronic",
    "Signatures in Global and National Commerce Act (E-SIGN) and the Uniform",
    "Electronic Transactions Act (UETA).",
  ];

  for (const line of bindingStatement) {
    if (line === "") {
      y -= 8;
    } else {
      page.drawText(line, { x: 55, y: y, size: 9, font: timesRoman });
      y -= 14;
    }
  }

  y -= 20;

  // Footer
  page.drawLine({
    start: { x: 50, y: y },
    end: { x: 562, y: y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 15;

  const generatedDate = new Date().toISOString();
  page.drawText(`Certificate Generated: ${formatDate(generatedDate)}`, {
    x: 50,
    y: y,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText('This certificate is automatically generated and cannot be altered after creation.', {
    x: 50,
    y: y - 12,
    size: 7,
    font: helvetica,
    color: rgb(0.6, 0.6, 0.6),
  });

  // Update page numbers for all pages including certificate
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;
  pages.forEach((p, idx) => {
    // Clear previous page number by drawing white rectangle (approximate)
    p.drawText(`Page ${idx + 1} of ${pageCount}`, {
      x: 306 - 30,
      y: 30,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  });
}

// Generate standalone Certificate PDF
async function generateCertificatePDF(
  lease: any,
  landlordName: string,
  tenantName: string,
  landlordSig: any,
  tenantSig: any,
  documentHash: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  await appendCertificatePage(
    pdfDoc,
    lease,
    landlordName,
    tenantName,
    landlordSig,
    tenantSig,
    documentHash || 'Not yet computed'
  );

  return await pdfDoc.save();
}
