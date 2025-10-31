import { Heading, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface TeamMemberUpdateProps {
  firstName: string;
  changes: string[];
  updatedBy: string;
}

export const TeamMemberUpdate = ({
  firstName,
  updatedBy,
}: TeamMemberUpdateProps) => {
  const previewText = `Your account has been updated by ${updatedBy}`;

  return (
    <EmailLayout preview={previewText}>
      <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
        Account Updated
      </Heading>

      <Text className="text-[14px] text-black leading-6">
        Hello {firstName},
      </Text>

      <Text className="text-[14px] text-black leading-6">
        <strong>{updatedBy}</strong> has updated your account.
      </Text>

      <div
        style={{
          backgroundColor: "#f9fafb",
          padding: "16px",
          borderRadius: "6px",
          borderLeft: "4px solid #71abbf",
          margin: "20px 0",
        }}
      >
        <Text className="text-[14px] text-[#525252] m-0">
          Your profile has been updated. Please log in to review the changes.
        </Text>
      </div>

      <Text className="text-[14px] text-black leading-6">
        If you have any questions about these changes, please contact your
        administrator.
      </Text>
    </EmailLayout>
  );
};
