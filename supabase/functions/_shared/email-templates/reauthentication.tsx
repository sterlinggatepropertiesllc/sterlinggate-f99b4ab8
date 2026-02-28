/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code for Sterling Gate Properties</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://nmibwtbrbpqfvseeflep.supabase.co/storage/v1/object/public/email-assets/logo.png"
          alt="Sterling Gate Properties"
          width="160"
          height="auto"
          style={logo}
        />
        <Heading style={h1}>Confirm your identity</Heading>
        <Text style={text}>Use the code below to verify your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px' }
const logo = { marginBottom: '24px' }
const h1 = {
  fontFamily: "'Outfit', Arial, sans-serif",
  fontSize: '24px',
  fontWeight: '500' as const,
  color: '#101720',
  margin: '0 0 20px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '15px',
  color: '#8B8F99',
  lineHeight: '1.6',
  margin: '0 0 25px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#D4A437',
  margin: '0 0 30px',
  letterSpacing: '0.1em',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
