import { computeVerhoeffCheckDigit } from "./validators";

const SYNTHETIC_AADHAAR_1_BASE = "34987654321";
const SYNTHETIC_AADHAAR_1 = `${SYNTHETIC_AADHAAR_1_BASE.slice(0, 4)} ${SYNTHETIC_AADHAAR_1_BASE.slice(4, 8)} ${SYNTHETIC_AADHAAR_1_BASE.slice(8)}${computeVerhoeffCheckDigit(SYNTHETIC_AADHAAR_1_BASE)}`;

const SYNTHETIC_AADHAAR_2_BASE = "58291047362";
const SYNTHETIC_AADHAAR_2 = `${SYNTHETIC_AADHAAR_2_BASE.slice(0, 4)}-${SYNTHETIC_AADHAAR_2_BASE.slice(4, 8)}-${SYNTHETIC_AADHAAR_2_BASE.slice(8)}${computeVerhoeffCheckDigit(SYNTHETIC_AADHAAR_2_BASE)}`;

export interface SyntheticSample {
  id: string;
  label: string;
  fileName: string;
  fileType: "TXT" | "CSV";
  description: string;
  content: string;
}

export const SYNTHETIC_SAMPLES: SyntheticSample[] = [
  {
    id: "kyc-incident-txt",
    label: "Synthetic KYC Audit Log (TXT)",
    fileName: "synthetic-kyc-audit-sample.txt",
    fileType: "TXT",
    description:
      "Demonstrates all 6 PII categories, duplicate entity reuse, Luhn-valid vs Luhn-invalid card candidates, and Verhoeff-valid Aadhaar format.",
    content: `[SYNTHETIC SAMPLE DOCUMENT — FOR DEMONSTRATION ONLY]
Incident Ticket: ZVX-2026-0419
Reporter Email: ananya.sharma@example-corp.in
Secondary Contact: ananya.sharma@example-corp.in (duplicate entity test)
Support Phone: +91 9876543210 | Backup US Line: (415) 555-0192
Source Workstation IP: 192.168.42.108 -> Gateway: 10.24.8.1
Applicant PAN: ABCPE1234F
Aadhaar-Format Candidate (Verhoeff Valid): ${SYNTHETIC_AADHAAR_1}
Test Payment Card (Luhn Valid Candidate): 4532-0151-1283-0366
Invalid Card Candidate (Fails Luhn, must not flag as card): 4532-0151-1283-0367
Release Version (must not flag as IPv4): v1.2.3.4 on 2026-11-27.`,
  },
  {
    id: "customer-export-csv",
    label: "Synthetic Customer Directory (CSV)",
    fileName: "synthetic-customer-export.csv",
    fileType: "CSV",
    description:
      "Tests CSV headers, commas inside quoted fields, escaped quotes, multiline notes, empty cells, and cross-row pseudonym consistency.",
    content: `CustomerID,FullName,Email,Phone,PAN,AadhaarCandidate,CardCandidate,IPAddress,Notes
CUST-101,"Mehta, Rohan",rohan.mehta@synthetic-mail.org,+91 9820112233,BXZPM4412K,${SYNTHETIC_AADHAAR_2},4111-1111-1111-1111,172.16.10.44,"Quoted ""VIP"" account, verified locally
Line 2 note: escalate to rohan.mehta@synthetic-mail.org"
CUST-102,"Nair, Priya",priya.nair@synthetic-mail.org,9845098450,AAACP9981L,,5500000000000004,10.0.14.9,"Empty Aadhaar cell preserved; invalid card 5500000000000005 ignored"
CUST-103,"Doe, Alex",rohan.mehta@synthetic-mail.org,(212) 555-0148,CDEPK7721Q,${SYNTHETIC_AADHAAR_1},4532015112830366,192.168.1.25,"Shares email with CUST-101 for consistent pseudonym check"`,
  },
];
