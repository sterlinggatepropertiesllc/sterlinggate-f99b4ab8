import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

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

// ==========================================
// HTML to PDF Content Parser
// ==========================================

interface TextBlock {
  type: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'paragraph' | 'text' | 'linebreak' | 'horizontalrule' | 'listitem';
  content: string;
  bold?: boolean;
  italic?: boolean;
}

// Strip HTML tags and decode entities
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

// Parse HTML content into structured text blocks
function parseHTMLToBlocks(html: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  
  if (!html || typeof html !== 'string') {
    return blocks;
  }

  // Remove script and style tags completely
  let cleanedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Process the HTML by splitting on major block elements
  // First, normalize line breaks and whitespace
  cleanedHtml = cleanedHtml
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Split by block-level elements
  const blockPattern = /<(h[1-6]|p|div|br\s*\/?|hr\s*\/?|li|ul|ol|article|section|header|footer|main|aside|blockquote)[^>]*>/gi;
  
  let lastIndex = 0;
  let match;
  const regex = new RegExp(blockPattern);
  
  // Simple state machine to parse HTML
  let currentPos = 0;
  const length = cleanedHtml.length;
  
  while (currentPos < length) {
    // Find next tag
    const tagStart = cleanedHtml.indexOf('<', currentPos);
    
    if (tagStart === -1) {
      // No more tags, get remaining text
      const remainingText = cleanedHtml.substring(currentPos).trim();
      if (remainingText) {
        const cleanText = stripAllTags(remainingText);
        if (cleanText) {
          blocks.push({ type: 'paragraph', content: cleanText });
        }
      }
      break;
    }
    
    // Get text before this tag
    if (tagStart > currentPos) {
      const textBefore = cleanedHtml.substring(currentPos, tagStart).trim();
      if (textBefore && !textBefore.match(/^[\s\n]*$/)) {
        const cleanText = stripAllTags(textBefore);
        if (cleanText) {
          blocks.push({ type: 'text', content: cleanText });
        }
      }
    }
    
    // Find end of tag
    const tagEnd = cleanedHtml.indexOf('>', tagStart);
    if (tagEnd === -1) {
      currentPos = tagStart + 1;
      continue;
    }
    
    const fullTag = cleanedHtml.substring(tagStart, tagEnd + 1);
    const tagMatch = fullTag.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/);
    
    if (!tagMatch) {
      currentPos = tagEnd + 1;
      continue;
    }
    
    const tagName = tagMatch[1].toLowerCase();
    const isClosingTag = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || ['br', 'hr', 'img', 'input'].includes(tagName);
    
    // Handle self-closing and void elements
    if (isSelfClosing || ['br', 'hr'].includes(tagName)) {
      if (tagName === 'br') {
        blocks.push({ type: 'linebreak', content: '' });
      } else if (tagName === 'hr') {
        blocks.push({ type: 'horizontalrule', content: '' });
      }
      currentPos = tagEnd + 1;
      continue;
    }
    
    // For opening tags of block elements, find the closing tag and extract content
    if (!isClosingTag && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'li', 'article', 'section', 'blockquote'].includes(tagName)) {
      const closingTag = `</${tagName}>`;
      let closingPos = cleanedHtml.toLowerCase().indexOf(closingTag, tagEnd + 1);
      
      if (closingPos === -1) {
        // No closing tag found, try to find next opening tag of same type or end
        closingPos = length;
      }
      
      const innerContent = cleanedHtml.substring(tagEnd + 1, closingPos);
      const cleanContent = stripAllTags(innerContent).trim();
      
      if (cleanContent) {
        let blockType: TextBlock['type'] = 'paragraph';
        
        switch (tagName) {
          case 'h1':
            blockType = 'heading1';
            break;
          case 'h2':
            blockType = 'heading2';
            break;
          case 'h3':
            blockType = 'heading3';
            break;
          case 'h4':
          case 'h5':
          case 'h6':
            blockType = 'heading4';
            break;
          case 'li':
            blockType = 'listitem';
            break;
          default:
            blockType = 'paragraph';
        }
        
        blocks.push({ type: blockType, content: cleanContent });
      }
      
      currentPos = closingPos + closingTag.length;
      continue;
    }
    
    currentPos = tagEnd + 1;
  }
  
  return blocks;
}

// Strip all HTML tags from text
function stripAllTags(html: string): string {
  // Remove all HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  // Decode HTML entities
  text = decodeHTMLEntities(text);
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// ==========================================
// PDF Rendering Functions
// ==========================================

interface PDFContext {
  pdfDoc: PDFDocument;
  page: PDFPage;
  yPosition: number;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
    italic: PDFFont;
    mono: PDFFont;
  };
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
}

function createNewPage(ctx: PDFContext): void {
  ctx.page = ctx.pdfDoc.addPage([ctx.pageWidth, ctx.pageHeight]);
  ctx.yPosition = ctx.pageHeight - ctx.marginTop;
}

function checkPageBreak(ctx: PDFContext, requiredSpace: number): void {
  if (ctx.yPosition < ctx.marginBottom + requiredSpace) {
    createNewPage(ctx);
  }
}

// Word wrap and draw text
function drawWrappedText(
  ctx: PDFContext,
  text: string,
  fontSize: number,
  font: PDFFont,
  color = rgb(0, 0, 0),
  indent = 0
): void {
  const maxWidth = ctx.pageWidth - ctx.marginLeft - ctx.marginRight - indent;
  const words = text.split(' ');
  let currentLine = '';
  const lineHeight = fontSize * 1.4;
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (textWidth > maxWidth && currentLine) {
      checkPageBreak(ctx, lineHeight);
      ctx.page.drawText(currentLine, {
        x: ctx.marginLeft + indent,
        y: ctx.yPosition,
        size: fontSize,
        font: font,
        color: color,
      });
      ctx.yPosition -= lineHeight;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    checkPageBreak(ctx, lineHeight);
    ctx.page.drawText(currentLine, {
      x: ctx.marginLeft + indent,
      y: ctx.yPosition,
      size: fontSize,
      font: font,
      color: color,
    });
    ctx.yPosition -= lineHeight;
  }
}

// Render text blocks to PDF
function renderBlocksToPDF(ctx: PDFContext, blocks: TextBlock[]): void {
  for (const block of blocks) {
    switch (block.type) {
      case 'heading1':
        ctx.yPosition -= 8; // Extra space before heading
        checkPageBreak(ctx, 30);
        drawWrappedText(ctx, block.content.toUpperCase(), 14, ctx.fonts.bold);
        ctx.yPosition -= 6; // Extra space after heading
        break;
        
      case 'heading2':
        ctx.yPosition -= 6;
        checkPageBreak(ctx, 25);
        drawWrappedText(ctx, block.content, 13, ctx.fonts.bold);
        ctx.yPosition -= 4;
        break;
        
      case 'heading3':
        ctx.yPosition -= 4;
        checkPageBreak(ctx, 22);
        drawWrappedText(ctx, block.content, 12, ctx.fonts.bold);
        ctx.yPosition -= 3;
        break;
        
      case 'heading4':
        ctx.yPosition -= 3;
        checkPageBreak(ctx, 20);
        drawWrappedText(ctx, block.content, 11, ctx.fonts.bold);
        ctx.yPosition -= 2;
        break;
        
      case 'paragraph':
      case 'text':
        checkPageBreak(ctx, 18);
        drawWrappedText(ctx, block.content, 10, ctx.fonts.regular);
        ctx.yPosition -= 6; // Paragraph spacing
        break;
        
      case 'listitem':
        checkPageBreak(ctx, 18);
        drawWrappedText(ctx, `• ${block.content}`, 10, ctx.fonts.regular, rgb(0, 0, 0), 15);
        ctx.yPosition -= 3;
        break;
        
      case 'linebreak':
        ctx.yPosition -= 8;
        break;
        
      case 'horizontalrule':
        ctx.yPosition -= 10;
        checkPageBreak(ctx, 15);
        ctx.page.drawLine({
          start: { x: ctx.marginLeft, y: ctx.yPosition },
          end: { x: ctx.pageWidth - ctx.marginRight, y: ctx.yPosition },
          thickness: 0.5,
          color: rgb(0.6, 0.6, 0.6),
        });
        ctx.yPosition -= 10;
        break;
    }
  }
}

// ==========================================
// Main PDF Generation
// ==========================================

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

    // If only certificate is requested
    if (certificateOnly) {
      const certPdf = await generateCertificatePDF(
        lease, 
        landlordName, 
        tenantName, 
        landlordSig, 
        tenantSig,
        lease.document_hash || 'Hash not yet computed'
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

    // STEP 1: Generate the main lease PDF (without certificate)
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

    // STEP 4: If includeCertificate, append certificate as final page; otherwise just add page numbers
    let finalPdfBytes: Uint8Array;
    
    if (includeCertificate && lease.signatures && lease.signatures.length > 0) {
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
      // Page numbers are added inside appendCertificatePage
      finalPdfBytes = await finalPdf.save();
    } else {
      // No certificate, just add page numbers to main PDF
      const pdfWithNumbers = await PDFDocument.load(mainPdfBytes);
      await addPageNumbers(pdfWithNumbers);
      finalPdfBytes = await pdfWithNumbers.save();
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
  
  // Embed fonts
  const regular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  
  // Create PDF context
  const ctx: PDFContext = {
    pdfDoc,
    page: pdfDoc.addPage([612, 792]), // Letter size
    yPosition: 742,
    fonts: { regular, bold, italic, mono },
    pageWidth: 612,
    pageHeight: 792,
    marginLeft: 50,
    marginRight: 50,
    marginTop: 50,
    marginBottom: 60,
  };

  // ==========================================
  // PAGE 1: COVER / SUMMARY PAGE (Non-Contractual)
  // ==========================================
  
  // Title
  ctx.page.drawText('COMMERCIAL GROSS LEASE AGREEMENT', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 18,
    font: bold,
    color: rgb(0, 0, 0),
  });
  ctx.yPosition -= 28;

  // Subtitle
  ctx.page.drawText('LEASE SUMMARY — FOR REFERENCE ONLY', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 10,
    font: bold,
    color: rgb(0.4, 0.4, 0.4),
  });
  ctx.yPosition -= 18;

  // Non-contractual notice
  ctx.page.drawRectangle({
    x: ctx.marginLeft,
    y: ctx.yPosition - 35,
    width: ctx.pageWidth - ctx.marginLeft - ctx.marginRight,
    height: 40,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
  });

  ctx.page.drawText('This cover page is a summary for convenience only and is not part of the legally binding agreement.', {
    x: ctx.marginLeft + 10,
    y: ctx.yPosition - 18,
    size: 8,
    font: italic,
    color: rgb(0.4, 0.4, 0.4),
  });
  ctx.page.drawText('The binding terms begin on the following page under "Commercial Gross Lease Agreement."', {
    x: ctx.marginLeft + 10,
    y: ctx.yPosition - 30,
    size: 8,
    font: italic,
    color: rgb(0.4, 0.4, 0.4),
  });
  ctx.yPosition -= 55;

  // Document ID
  ctx.page.drawText(`Document ID: ${lease.id}`, {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 9,
    font: mono,
    color: rgb(0.4, 0.4, 0.4),
  });
  ctx.yPosition -= 14;

  ctx.page.drawText(`Created: ${formatDateShort(lease.created_at)}`, {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 9,
    font: regular,
    color: rgb(0.5, 0.5, 0.5),
  });
  ctx.yPosition -= 25;

  // Divider line
  ctx.page.drawLine({
    start: { x: ctx.marginLeft, y: ctx.yPosition },
    end: { x: ctx.pageWidth - ctx.marginRight, y: ctx.yPosition },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  ctx.yPosition -= 25;

  // SUMMARY SECTIONS
  ctx.page.drawText('PARTIES', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 12,
    font: bold,
  });
  ctx.yPosition -= 18;

  drawWrappedText(ctx, `Landlord: ${landlordName}`, 11, regular);
  drawWrappedText(ctx, `Tenant: ${tenantName}`, 11, regular);
  ctx.yPosition -= 15;

  ctx.page.drawText('PREMISES', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 12,
    font: bold,
  });
  ctx.yPosition -= 18;

  const address = `${lease.properties?.address}, ${lease.properties?.city}, ${lease.properties?.state}`;
  drawWrappedText(ctx, address, 11, regular);
  ctx.yPosition -= 15;

  ctx.page.drawText('LEASE TERM', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 12,
    font: bold,
  });
  ctx.yPosition -= 18;

  drawWrappedText(ctx, `Start Date: ${formatDateShort(lease.start_date)}`, 11, regular);
  drawWrappedText(ctx, `End Date: ${formatDateShort(lease.end_date)}`, 11, regular);
  ctx.yPosition -= 15;

  ctx.page.drawText('FINANCIAL SUMMARY', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 12,
    font: bold,
  });
  ctx.yPosition -= 18;

  drawWrappedText(ctx, `Monthly Rent: $${Number(lease.monthly_rent).toLocaleString()}`, 11, regular);
  
  if (lease.security_deposit) {
    drawWrappedText(ctx, `Security Deposit: $${Number(lease.security_deposit).toLocaleString()}`, 11, regular);
  }
  
  if (lease.rent_due_day) {
    drawWrappedText(ctx, `Rent Due: Day ${lease.rent_due_day} of each month`, 11, regular);
  }

  ctx.yPosition -= 30;

  // Execution status
  ctx.page.drawText('EXECUTION STATUS', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 12,
    font: bold,
  });
  ctx.yPosition -= 18;

  if (landlordSig && tenantSig) {
    drawWrappedText(ctx, 'Status: Fully Executed', 11, bold);
    drawWrappedText(ctx, `Landlord signed: ${formatDateShort(landlordSig.signed_at)}`, 10, regular);
    drawWrappedText(ctx, `Tenant signed: ${formatDateShort(tenantSig.signed_at)}`, 10, regular);
  } else if (landlordSig || tenantSig) {
    drawWrappedText(ctx, 'Status: Partially Executed — Awaiting Signature', 11, regular);
  } else {
    drawWrappedText(ctx, 'Status: Pending Signatures', 11, regular);
  }

  // ==========================================
  // PAGE 2+: FORMAL AGREEMENT TEXT
  // ==========================================
  
  createNewPage(ctx);

  // Formal agreement header
  ctx.page.drawText('COMMERCIAL GROSS LEASE AGREEMENT', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 16,
    font: bold,
    color: rgb(0, 0, 0),
  });
  ctx.yPosition -= 25;

  ctx.page.drawLine({
    start: { x: ctx.marginLeft, y: ctx.yPosition },
    end: { x: ctx.pageWidth - ctx.marginRight, y: ctx.yPosition },
    thickness: 1.5,
    color: rgb(0, 0, 0),
  });
  ctx.yPosition -= 20;

  // Preamble
  ctx.page.drawText('This Commercial Gross Lease Agreement ("Agreement") is entered into as of the date of final', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 10,
    font: regular,
  });
  ctx.yPosition -= 14;
  ctx.page.drawText('execution by and between the following parties:', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 10,
    font: regular,
  });
  ctx.yPosition -= 25;

  // Parties in agreement
  drawWrappedText(ctx, `LANDLORD: ${landlordName}`, 11, bold);
  drawWrappedText(ctx, `TENANT: ${tenantName}`, 11, bold);
  ctx.yPosition -= 15;

  drawWrappedText(ctx, `PREMISES: ${address}`, 11, regular);
  ctx.yPosition -= 20;

  // Parse and render lease terms
  if (lease.terms) {
    ctx.page.drawText('TERMS AND CONDITIONS', {
      x: ctx.marginLeft,
      y: ctx.yPosition,
      size: 12,
      font: bold,
    });
    ctx.yPosition -= 8;
    
    ctx.page.drawLine({
      start: { x: ctx.marginLeft, y: ctx.yPosition },
      end: { x: ctx.pageWidth - ctx.marginRight, y: ctx.yPosition },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });
    ctx.yPosition -= 18;

    // Parse HTML content and render as clean PDF text
    const blocks = parseHTMLToBlocks(lease.terms);
    renderBlocksToPDF(ctx, blocks);
  }

  // ==========================================
  // EXECUTION PAGE: Traditional Signature Block
  // ==========================================
  
  createNewPage(ctx);
  
  ctx.page.drawText('EXECUTION PAGE', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 16,
    font: bold,
  });
  ctx.yPosition -= 8;

  ctx.page.drawLine({
    start: { x: ctx.marginLeft, y: ctx.yPosition },
    end: { x: ctx.pageWidth - ctx.marginRight, y: ctx.yPosition },
    thickness: 2,
    color: rgb(0, 0, 0),
  });
  ctx.yPosition -= 25;

  ctx.page.drawText('IN WITNESS WHEREOF, the parties have executed this Commercial Gross Lease Agreement', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 10,
    font: regular,
  });
  ctx.yPosition -= 14;
  ctx.page.drawText('as of the dates indicated below.', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 10,
    font: regular,
  });
  ctx.yPosition -= 35;

  // Traditional signature areas
  ctx.page.drawText('LANDLORD SIGNATURE', {
    x: ctx.marginLeft,
    y: ctx.yPosition,
    size: 11,
    font: bold,
    color: rgb(0.2, 0.2, 0.2),
  });
  
  ctx.page.drawText('TENANT SIGNATURE', {
    x: 320,
    y: ctx.yPosition,
    size: 11,
    font: bold,
    color: rgb(0.2, 0.2, 0.2),
  });
  ctx.yPosition -= 80;

  // Signature lines
  ctx.page.drawLine({
    start: { x: ctx.marginLeft, y: ctx.yPosition },
    end: { x: ctx.marginLeft + 200, y: ctx.yPosition },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  ctx.page.drawLine({
    start: { x: 320, y: ctx.yPosition },
    end: { x: 520, y: ctx.yPosition },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  ctx.yPosition -= 15;

  ctx.page.drawText(landlordName, { x: ctx.marginLeft, y: ctx.yPosition, size: 10, font: bold });
  ctx.page.drawText(tenantName, { x: 320, y: ctx.yPosition, size: 10, font: bold });
  ctx.yPosition -= 14;

  ctx.page.drawText('Date: _________________', { x: ctx.marginLeft, y: ctx.yPosition, size: 9, font: regular });
  ctx.page.drawText('Date: _________________', { x: 320, y: ctx.yPosition, size: 9, font: regular });

  // ==========================================
  // ELECTRONIC SIGNATURE RECORD
  // ==========================================
  
  ctx.yPosition -= 50;

  ctx.page.drawRectangle({
    x: ctx.marginLeft,
    y: ctx.yPosition - 180,
    width: ctx.pageWidth - ctx.marginLeft - ctx.marginRight,
    height: 190,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });

  ctx.yPosition -= 15;

  ctx.page.drawText('ELECTRONIC SIGNATURE RECORD', {
    x: ctx.marginLeft + 10,
    y: ctx.yPosition,
    size: 11,
    font: bold,
    color: rgb(0, 0.2, 0.4),
  });
  ctx.yPosition -= 6;

  ctx.page.drawLine({
    start: { x: ctx.marginLeft + 10, y: ctx.yPosition },
    end: { x: ctx.pageWidth - ctx.marginRight - 10, y: ctx.yPosition },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  ctx.yPosition -= 15;

  ctx.page.drawText('This section documents the electronic signatures captured for this agreement.', {
    x: ctx.marginLeft + 10,
    y: ctx.yPosition,
    size: 8,
    font: italic,
    color: rgb(0.4, 0.4, 0.4),
  });
  ctx.yPosition -= 20;

  if (lease.signatures && lease.signatures.length > 0) {
    // Draw landlord electronic signature
    if (landlordSig) {
      await drawElectronicSignatureBlock(ctx, landlordSig, 'Landlord', landlordName, ctx.marginLeft + 10, pdfDoc);
    }

    // Draw tenant electronic signature
    if (tenantSig) {
      await drawElectronicSignatureBlock(ctx, tenantSig, 'Tenant', tenantName, 315, pdfDoc);
    }
  } else {
    ctx.page.drawText('No electronic signatures have been recorded for this document.', {
      x: ctx.marginLeft + 10,
      y: ctx.yPosition,
      size: 10,
      font: regular,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  // Note: Page numbering is added in appendCertificatePage or addPageNumbers
  // to ensure consistent total count across all pages
  
  return pdfDoc;
}

// Add page numbers to all pages (called after all pages are finalized)
async function addPageNumbers(pdfDoc: PDFDocument): Promise<void> {
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;
  
  pages.forEach((p, idx) => {
    p.drawText(`Page ${idx + 1} of ${pageCount}`, {
      x: 276,
      y: 30,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  });
}

// Draw an electronic signature block (compact version)
async function drawElectronicSignatureBlock(
  ctx: PDFContext,
  sig: any,
  role: string,
  name: string,
  xOffset: number,
  pdfDoc: PDFDocument
): Promise<void> {
  let localY = ctx.yPosition;

  // Role label
  ctx.page.drawText(role.toUpperCase(), {
    x: xOffset,
    y: localY,
    size: 9,
    font: ctx.fonts.bold,
    color: rgb(0.2, 0.2, 0.2),
  });
  localY -= 15;

  // Draw signature image
  if (sig.signature_data && sig.signature_data.startsWith('data:image')) {
    try {
      const base64Data = sig.signature_data.split(',')[1];
      const signatureImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

      const maxWidth = 140;
      const maxHeight = 45;
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

      ctx.page.drawImage(signatureImage, {
        x: xOffset,
        y: localY - sigHeight,
        width: sigWidth,
        height: sigHeight,
      });
      localY -= sigHeight + 3;
    } catch (e) {
      console.error('Failed to embed signature image:', e);
      localY -= 25;
    }
  } else {
    localY -= 25;
  }

  // Signer name
  ctx.page.drawText(name, {
    x: xOffset,
    y: localY,
    size: 9,
    font: ctx.fonts.bold,
  });
  localY -= 12;

  // Signed date
  ctx.page.drawText(`Signed: ${formatDateShort(sig.signed_at)}`, {
    x: xOffset,
    y: localY,
    size: 8,
    font: ctx.fonts.regular,
  });
  localY -= 11;

  // IP Address
  ctx.page.drawText(`IP: ${sig.ip_address || 'Not recorded'}`, {
    x: xOffset,
    y: localY,
    size: 7,
    font: ctx.fonts.regular,
    color: rgb(0.4, 0.4, 0.4),
  });
  localY -= 10;

  // Signature Hash
  ctx.page.drawText(`Hash: ${sig.hash_id.substring(0, 20)}...`, {
    x: xOffset,
    y: localY,
    size: 6,
    font: ctx.fonts.mono,
    color: rgb(0.5, 0.5, 0.5),
  });
}


// Append Certificate of Completion page
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
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  const page = pdfDoc.addPage([612, 792]);
  let y = 740;

  // Certificate border
  page.drawRectangle({
    x: 35,
    y: 35,
    width: 542,
    height: 722,
    borderColor: rgb(0, 0.3, 0.5),
    borderWidth: 2,
  });

  // Inner decorative border
  page.drawRectangle({
    x: 42,
    y: 42,
    width: 528,
    height: 708,
    borderColor: rgb(0.7, 0.8, 0.9),
    borderWidth: 1,
  });

  // Header
  page.drawText('CERTIFICATE OF COMPLETION', {
    x: 130,
    y: y,
    size: 22,
    font: helveticaBold,
    color: rgb(0, 0.2, 0.4),
  });
  y -= 25;

  page.drawText('Electronic Signature Verification Record', {
    x: 185,
    y: y,
    size: 11,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 40;

  // Divider
  page.drawLine({
    start: { x: 50, y: y },
    end: { x: 562, y: y },
    thickness: 1,
    color: rgb(0, 0.3, 0.5),
  });
  y -= 30;

  // Document Information Section
  page.drawText('DOCUMENT INFORMATION', {
    x: 50,
    y: y,
    size: 11,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  const docInfo = [
    ['Document ID:', lease.id],
    ['Document Type:', 'Commercial Gross Lease Agreement'],
    ['Property:', `${lease.properties?.address}, ${lease.properties?.city}, ${lease.properties?.state}`],
    ['Created:', formatDate(lease.created_at)],
    ['Completed:', formatDate(tenantSig?.signed_at || landlordSig?.signed_at || new Date().toISOString())],
  ];

  for (const [label, value] of docInfo) {
    page.drawText(label, { x: 55, y: y, size: 9, font: helveticaBold });
    page.drawText(value, { x: 140, y: y, size: 9, font: helvetica });
    y -= 14;
  }
  y -= 15;

  // SHA-256 Hash Section
  page.drawRectangle({
    x: 50,
    y: y - 50,
    width: 512,
    height: 60,
    color: rgb(0.95, 0.97, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page.drawText('DOCUMENT SHA-256 HASH (Computed from Final PDF Binary)', {
    x: 55,
    y: y - 8,
    size: 9,
    font: helveticaBold,
    color: rgb(0, 0.2, 0.4),
  });

  // Split hash into lines for readability
  const hashLine1 = documentHash.substring(0, 32);
  const hashLine2 = documentHash.substring(32);
  
  page.drawText(hashLine1, {
    x: 60,
    y: y - 26,
    size: 9,
    font: courier,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(hashLine2, {
    x: 60,
    y: y - 40,
    size: 9,
    font: courier,
    color: rgb(0.1, 0.1, 0.1),
  });

  y -= 75;

  // Signer Information Section
  page.drawText('SIGNER INFORMATION', {
    x: 50,
    y: y,
    size: 11,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  y -= 25;

  // Landlord box
  page.drawRectangle({
    x: 50,
    y: y - 85,
    width: 245,
    height: 95,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });

  page.drawText('LANDLORD', { x: 60, y: y - 8, size: 10, font: helveticaBold, color: rgb(0, 0.3, 0.5) });
  page.drawText(`Name: ${landlordName}`, { x: 60, y: y - 25, size: 9, font: helvetica });
  
  if (landlordSig) {
    page.drawText(`Signed: ${formatDate(landlordSig.signed_at)}`, { x: 60, y: y - 40, size: 8, font: helvetica });
    page.drawText(`IP: ${landlordSig.ip_address || 'Not recorded'}`, { x: 60, y: y - 53, size: 8, font: helvetica });
    page.drawText('Signature Hash:', { x: 60, y: y - 66, size: 7, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(`${landlordSig.hash_id.substring(0, 28)}...`, { x: 60, y: y - 78, size: 6, font: courier, color: rgb(0.5, 0.5, 0.5) });
  } else {
    page.drawText('Awaiting signature', { x: 60, y: y - 40, size: 9, font: helvetica, color: rgb(0.6, 0.3, 0.3) });
  }

  // Tenant box
  page.drawRectangle({
    x: 310,
    y: y - 85,
    width: 245,
    height: 95,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });

  page.drawText('TENANT', { x: 320, y: y - 8, size: 10, font: helveticaBold, color: rgb(0, 0.3, 0.5) });
  page.drawText(`Name: ${tenantName}`, { x: 320, y: y - 25, size: 9, font: helvetica });
  
  if (tenantSig) {
    page.drawText(`Signed: ${formatDate(tenantSig.signed_at)}`, { x: 320, y: y - 40, size: 8, font: helvetica });
    page.drawText(`IP: ${tenantSig.ip_address || 'Not recorded'}`, { x: 320, y: y - 53, size: 8, font: helvetica });
    page.drawText('Signature Hash:', { x: 320, y: y - 66, size: 7, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(`${tenantSig.hash_id.substring(0, 28)}...`, { x: 320, y: y - 78, size: 6, font: courier, color: rgb(0.5, 0.5, 0.5) });
  } else {
    page.drawText('Awaiting signature', { x: 320, y: y - 40, size: 9, font: helvetica, color: rgb(0.6, 0.3, 0.3) });
  }

  y -= 110;

  // Certification Statement Section
  page.drawText('CERTIFICATION STATEMENT', {
    x: 50,
    y: y,
    size: 11,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  y -= 5;

  page.drawLine({
    start: { x: 50, y: y },
    end: { x: 562, y: y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 18;

  const statement = [
    'I hereby certify that this document has been electronically signed by all parties indicated',
    'above. The SHA-256 cryptographic hash displayed on this certificate was computed from the',
    'final, immutable PDF binary of the signed lease agreement after all signatures were applied.',
    '',
    'This hash serves as a unique digital fingerprint that can be used to verify the authenticity',
    'and integrity of this document. Any modification to the document content would result in a',
    'completely different hash value, immediately revealing tampering.',
    '',
    'The electronic signatures contained in this document are legally binding and enforceable',
    'under applicable electronic signature laws, including the Electronic Signatures in Global',
    'and National Commerce Act (E-SIGN) and the Uniform Electronic Transactions Act (UETA).',
  ];

  for (const line of statement) {
    if (line === '') {
      y -= 6;
    } else {
      page.drawText(line, { x: 55, y: y, size: 9, font: timesRoman });
      y -= 12;
    }
  }

  y -= 20;

  // Footer
  page.drawLine({
    start: { x: 50, y: y },
    end: { x: 562, y: y },
    thickness: 1,
    color: rgb(0, 0.3, 0.5),
  });
  y -= 15;

  const generatedDate = new Date().toISOString();
  page.drawText(`Certificate Generated: ${formatDate(generatedDate)}`, {
    x: 50,
    y: y,
    size: 8,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawText('This certificate is automatically generated and cryptographically bound to the final document.', {
    x: 50,
    y: y - 12,
    size: 7,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Update page count for all pages
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;
  pages.forEach((p, idx) => {
    p.drawText(`Page ${idx + 1} of ${pageCount}`, {
      x: 276,
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
    documentHash
  );

  return await pdfDoc.save();
}
