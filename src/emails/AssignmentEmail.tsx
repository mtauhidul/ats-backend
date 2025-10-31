import { Button, Heading, Link, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

interface AssignmentEmailProps {
  firstName: string;
  entityType: string;
  entityName: string;
  assignedBy: string;
  dashboardUrl: string;
}

export const AssignmentEmail = ({
  firstName,
  entityType,
  entityName,
  assignedBy,
  dashboardUrl,
}: AssignmentEmailProps) => {
  const previewText = `You've been assigned to ${entityName}`;

  return (
    <EmailLayout preview={previewText}>
      <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
        New Assignment
      </Heading>

      <Text className="text-[14px] text-black leading-6">
        Hello {firstName},
      </Text>

      <Text className="text-[14px] text-black leading-6">
        <strong>{assignedBy}</strong> has assigned you to a new {entityType}:
      </Text>

      <div
        style={{
          backgroundColor: "#f0fdf4",
          padding: "20px",
          borderRadius: "8px",
          borderLeft: "4px solid #10b981",
          margin: "20px 0",
        }}
      >
        <Text className="text-[18px] font-bold text-[#065f46] m-0 mb-2">
          {entityName}
        </Text>
        <Text className="text-[14px] text-[#047857] m-0">
          <strong>Type:</strong> {entityType}
        </Text>
      </div>

      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <Button
          className="rounded bg-[#10b981] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
          href={dashboardUrl}
        >
          View in Dashboard
        </Button>
      </div>

      <Text className="text-[14px] text-black leading-6">
        or copy and paste this URL into your browser:{" "}
        <Link href={dashboardUrl} className="text-[#71abbf] no-underline">
          {dashboardUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
};
