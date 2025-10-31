import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";
import * as React from "react";

interface EmailLayoutProps {
  children: React.ReactNode;
  preview?: string;
}

export const EmailLayout = ({ children, preview }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
        }}
      >
        <Body className="mx-auto my-auto bg-white px-2 font-sans">
          {preview && <Text className="hidden">{preview}</Text>}
          <Container className="mx-auto my-10 max-w-[465px] rounded border border-[#eaeaea] border-solid p-5">
            {/* Header with Logo */}
            <Section className="mt-8 text-center">
              <Text className="text-[24px] font-bold text-[#71abbf] m-0">
                YTFCS ATS
              </Text>
            </Section>

            {/* Content */}
            <Section className="mt-8">{children}</Section>

            {/* Footer */}
            <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
            <Text className="text-[#666666] text-[12px] leading-6">
              © {new Date().getFullYear()} YTFCS ATS. All rights reserved.
              <br />
              This is an automated message from your applicant tracking system.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
