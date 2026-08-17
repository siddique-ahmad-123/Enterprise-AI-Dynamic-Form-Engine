import { FormNode, FormAgentState } from "../types/form";

export const defaultFormTree: FormNode = {
  node_id: "root_mortgage_form",
  node_type: "form",
  label: "UAE Mortgage Application System",
  children: [
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 0 · Consents & Declarations
    // ─────────────────────────────────────────────────────────────────────────
    {
      node_id: "tab_consents",
      node_type: "tab",
      label: "Consents & Declarations",
      children: [
        {
          node_id: "sec_documents_download",
          node_type: "section",
          label: "Documents Download",
          children: [
            {
              node_id: "download_terms",
              node_type: "action_button",
              label: "Download Terms & Conditions",
            },
            {
              node_id: "download_fees",
              node_type: "action_button",
              label: "Download Fees & Charges",
            },
            {
              node_id: "download_kfs",
              node_type: "action_button",
              label: "Download Key Fact Statement",
            },
          ],
        },
        {
          node_id: "sec_consent_agreement",
          node_type: "section",
          label: "Agreement Declarations",
          children: [
            {
              node_id: "isCheckedTermandCond",
              node_type: "field",
              label: "I agree with Terms & Conditions, Fees Sheet and Key Fact Statement",
              field_type: "checkbox",
              required: true,
              value: false,
            },
            {
              node_id: "isCheckedLifestyle",
              node_type: "field",
              label: "I verify that declared lifestyle expenses are true to the best of my knowledge",
              field_type: "checkbox",
              required: true,
              value: false,
            },
            {
              node_id: "isCheckedPrivacy",
              node_type: "field",
              label: "I have read and understood the Privacy Notice",
              field_type: "checkbox",
              required: true,
              value: false,
            },
          ],
        },
        {
          node_id: "sec_required_amount",
          node_type: "section",
          label: "Required Finance Amount",
          children: [
            {
              node_id: "selectedRequiredAmount",
              node_type: "slider",
              label: "Select Required Amount",
              min: 50000,
              max: 10000000,
              step: 1000,
              unit: "AED",
              value: 500000,
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1 · Personal Details – Borrower
    // ─────────────────────────────────────────────────────────────────────────
    {
      node_id: "tab_personal_borrower",
      node_type: "tab",
      label: "Personal Details – Borrower",
      children: [
        {
          node_id: "sec_nationality_status",
          node_type: "section",
          label: "Applicant Type & Identity Documents",
          description: "Shown for New-to-Bank (NTB) customers",
          children: [
            {
              node_id: "borrowerNationalityStatus",
              node_type: "segment",
              label: "Nationality Status",
              options: ["Emirati", "Expat"],
              value: "Emirati",
            },
            {
              node_id: "upload_emirates_id",
              node_type: "upload",
              label: "Upload Emirates ID",
            },
            {
              node_id: "upload_passport",
              node_type: "upload",
              label: "Upload Passport",
            },
            {
              node_id: "upload_visa",
              node_type: "upload",
              label: "Upload Visa",
              condition: "borrowerNationalityStatus === 'Expat'",
            },
            {
              node_id: "btn_fetch_details",
              node_type: "action_button",
              label: "Fetch EIDA Details",
            },
          ],
        },
        {
          node_id: "sec_personal_information",
          node_type: "section",
          label: "Personal Information",
          children: [
            {
              node_id: "borrowerName",
              node_type: "field",
              label: "Borrower Full Name",
              field_type: "text",
              required: true,
              placeholder: "Enter full name",
              value: "",
            },
            {
              node_id: "borrowerDOB",
              node_type: "field",
              label: "Date of Birth",
              field_type: "date",
              required: true,
              value: "",
            },
            {
              node_id: "borrowerAge",
              node_type: "field",
              label: "Age (Years)",
              field_type: "number",
              readonly: true,
              description: "Auto-calculated from Date of Birth",
              placeholder: "Auto-calculated",
              value: "",
            },
            {
              node_id: "borrowerGender",
              node_type: "field",
              label: "Gender",
              field_type: "select",
              options: ["Male", "Female", "Others"],
              value: "",
            },
            {
              node_id: "borrowerNationality",
              node_type: "field",
              label: "Nationality",
              field_type: "select",
              options: ["Indian", "Sri Lanka", "UAE", "British", "Pakistani"],
              value: "",
            },
            {
              node_id: "borrowerResidenceCountry",
              node_type: "field",
              label: "Residence Country",
              field_type: "select",
              options: ["United Arab Emirates", "India", "United Kingdom"],
              value: "",
            },
            {
              node_id: "borrowerEidaNo",
              node_type: "field",
              label: "Emirates ID (EIDA) No",
              field_type: "number",
              placeholder: "784-1994-1234567-1",
              value: "",
            },
            {
              node_id: "borrowerEidaIssueDate",
              node_type: "field",
              label: "EIDA Issue Date",
              field_type: "date",
              value: "",
            },
            {
              node_id: "borrowerEidaExpiryDate",
              node_type: "field",
              label: "EIDA Expiry Date",
              field_type: "date",
              value: "",
            },
            {
              node_id: "borrowerPassportNo",
              node_type: "field",
              label: "Passport No",
              field_type: "text",
              placeholder: "Enter passport number",
              value: "",
            },
            {
              node_id: "borrowerEmailId",
              node_type: "field",
              label: "Email ID",
              field_type: "email",
              required: true,
              placeholder: "Enter email address",
              value: "",
            },
            {
              node_id: "borrowerMobileNo",
              node_type: "field",
              label: "Mobile No",
              field_type: "phone",
              required: true,
              placeholder: "+971 50 123 4567",
              value: "",
            },
            {
              node_id: "borrowerResidenceVintage",
              node_type: "field",
              label: "Residence Vintage (Months)",
              field_type: "number",
              placeholder: "Enter residence vintage",
              value: "",
            },
            {
              node_id: "borrowerNoOfDependents",
              node_type: "field",
              label: "No of Dependents",
              field_type: "number",
              placeholder: "Enter number of dependents",
              value: "",
            },
          ],
        },
        {
          node_id: "sec_address_information",
          node_type: "section",
          label: "Address Information",
          children: [
            {
              node_id: "borrowerAddressLine1",
              node_type: "field",
              label: "Address Line 1",
              field_type: "text",
              placeholder: "Building / Flat No, Street",
              value: "",
            },
            {
              node_id: "borrowerAddressLine2",
              node_type: "field",
              label: "Address Line 2",
              field_type: "text",
              placeholder: "Area / Locality / Landmark",
              value: "",
            },
            {
              node_id: "borrowerCity",
              node_type: "field",
              label: "City",
              field_type: "text",
              placeholder: "Enter City",
              value: "",
            },
            {
              node_id: "borrowerState",
              node_type: "field",
              label: "State",
              field_type: "text",
              placeholder: "Enter State / Province",
              value: "",
            },
            {
              node_id: "borrowerPinCode",
              node_type: "field",
              label: "PIN Code",
              field_type: "text",
              placeholder: "Enter PIN / Zip Code",
              value: "",
            },
            {
              node_id: "borrowerCountry",
              node_type: "field",
              label: "Country",
              field_type: "select",
              options: ["United Arab Emirates", "India", "Germany", "United Kingdom", "United States"],
              value: "",
            },
            {
              node_id: "borrowerEmirates",
              node_type: "field",
              label: "Emirates",
              field_type: "select",
              options: [
                "Abu Dhabi",
                "Ajman",
                "Dubai",
                "Fujairah",
                "Ras Al Khaimah",
                "Sharjah",
                "Umm Al Quwain",
              ],
              value: "",
            },
          ],
        },
        {
          node_id: "sec_efr_check",
          node_type: "section",
          label: "Emirates Facial Recognition (EFR) Check",
          children: [
            {
              node_id: "btn_run_efr",
              node_type: "action_button",
              label: "Run EFR Biometric Verification",
            },
            {
              node_id: "borrowerVerificationStatus",
              node_type: "field",
              label: "Verification Status",
              field_type: "select",
              readonly: true,
              options: ["Initiated", "Pending", "Verified"],
              value: "Verified",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2 · Personal Details – Co-Borrower
    // ─────────────────────────────────────────────────────────────────────────
    {
      node_id: "tab_personal_coborrower",
      node_type: "tab",
      label: "Personal Details – Co-Borrower",
      children: [
        {
          node_id: "sec_coborrower_toggle",
          node_type: "section",
          label: "Co-Borrower Selection",
          children: [
            {
              node_id: "isCoBorrower",
              node_type: "segment",
              label: "Do you want to add Co-Borrower?",
              options: ["Yes", "No"],
              value: "",
            },
            {
              node_id: "btn_add_coborrower",
              node_type: "action_button",
              label: "Add Co-Borrower",
              condition: "isCoBorrower === 'Yes'",
            },
          ],
        },
        {
          node_id: "sec_coborrower_details",
          node_type: "section",
          label: "Co-Borrower Information",
          condition: "isCoBorrower === 'Yes'",
          children: [
            {
              node_id: "coBorrowerEidaNo",
              node_type: "field",
              label: "Co-Borrower EIDA No",
              field_type: "number",
              required: true,
              placeholder: "Enter EIDA number",
              value: "",
            },
            {
              node_id: "coBorrowerMobileNo",
              node_type: "field",
              label: "Co-Borrower Mobile No",
              field_type: "phone",
              required: true,
              placeholder: "Enter mobile number",
              value: "",
            },
            {
              node_id: "coBorrowerName",
              node_type: "field",
              label: "Co-Borrower Full Name",
              field_type: "text",
              required: true,
              placeholder: "Enter full name",
              value: "",
            },
            {
              node_id: "coBorrowerGender",
              node_type: "field",
              label: "Gender",
              field_type: "select",
              options: ["Male", "Female", "Others"],
              value: "Female",
            },
            {
              node_id: "coBorrowerNationality",
              node_type: "field",
              label: "Nationality",
              field_type: "select",
              options: ["UAE", "Indian", "British"],
              value: "UAE",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3 · Income Details – Borrower
    // ─────────────────────────────────────────────────────────────────────────
    {
      node_id: "tab_income_borrower",
      node_type: "tab",
      label: "Income Details – Borrower",
      children: [
        {
          node_id: "sec_income_type_selector",
          node_type: "section",
          label: "Income Type Selection",
          children: [
            {
              node_id: "borrowerIncomeType",
              node_type: "segment",
              label: "Select Income Type",
              options: ["Salaried", "Self Employed"],
              value: "Salaried",
            },
          ],
        },

        // Salaried Path
        {
          node_id: "sec_employment_information",
          node_type: "section",
          label: "Employment Information",
          condition: "borrowerIncomeType === 'Salaried'",
          children: [
            {
              node_id: "borrowerEmpDetailFetchMethod",
              node_type: "field",
              label: "Select Method to Fetch Employment Details",
              field_type: "select",
              options: ["AECB", "Salary Certificate"],
              value: "Salary Certificate",
            },
            {
              node_id: "upload_salary_certificate",
              node_type: "upload",
              label: "Upload Salary Certificate",
              condition: "borrowerEmpDetailFetchMethod === 'Salary Certificate'",
            },
            {
              node_id: "borrowerEmployerName",
              node_type: "field",
              label: "Employer Name",
              field_type: "text",
              required: true,
              placeholder: "Enter employer company name",
              value: "",
            },
            {
              node_id: "borrowerEmployedFrom",
              node_type: "field",
              label: "Employed From Date",
              field_type: "date",
              value: "",
            },
            {
              node_id: "borrowerCurrentExp",
              node_type: "field",
              label: "Current Experience (Months)",
              field_type: "number",
              placeholder: "Enter experience",
              value: "",
            },
            {
              node_id: "borrowerTotalExp",
              node_type: "field",
              label: "Total Experience (Months)",
              field_type: "number",
              placeholder: "Enter total experience",
              value: "",
            },
          ],
        },

        {
          node_id: "sec_salary_income_details",
          node_type: "section",
          label: "Income Details (Salaried)",
          condition: "borrowerIncomeType === 'Salaried'",
          children: [
            {
              node_id: "borrowerSalaryIncomeDetailFetchMethod",
              node_type: "field",
              label: "Select Method to Fetch Income Details",
              field_type: "select",
              options: ["Salary Transfer", "UAE-FTS"],
              value: "",
            },
            {
              node_id: "borrowerMonthlySalaryBankTransfer",
              node_type: "field",
              label: "Monthly Salary (Bank Transfer AED)",
              field_type: "number",
              required: true,
              placeholder: "Enter monthly salary",
              value: "",
            },
            {
              node_id: "borrowerMonthlySalaryAECB",
              node_type: "field",
              label: "Monthly Salary (AECB Credit)",
              field_type: "number",
              placeholder: "AECB declared salary",
              value: "",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4 · Product & Loan Details
    // ─────────────────────────────────────────────────────────────────────────
    {
      node_id: "tab_product_loan",
      node_type: "tab",
      label: "Product & Loan Details",
      children: [
        {
          node_id: "sec_product_details",
          node_type: "section",
          label: "Product & Pricing Parameters",
          children: [
            {
              node_id: "loanType",
              node_type: "field",
              label: "Loan Type",
              field_type: "select",
              options: ["Home Purchase Loan", "Refinance", "Equity Release"],
              value: "Home Purchase Loan",
            },
            {
              node_id: "purpose",
              node_type: "field",
              label: "Purpose",
              field_type: "select",
              options: ["Primary Residence", "Investment Property", "Holiday Home"],
              value: "Primary Residence",
            },
            {
              node_id: "roiType",
              node_type: "field",
              label: "ROI Type",
              field_type: "select",
              options: ["Fixed Rate", "Variable Rate", "Hybrid Rate"],
              value: "Fixed Rate",
            },
            {
              node_id: "loanAmount",
              node_type: "slider",
              label: "Select Loan Amount",
              min: 50000,
              max: 10000000,
              step: 10000,
              unit: "AED",
              value: 2500000,
            },
            {
              node_id: "tenure",
              node_type: "slider",
              label: "Tenure (Months)",
              min: 12,
              max: 300,
              step: 12,
              unit: "Mon",
              value: 240,
            },
            {
              node_id: "rateOfInterest",
              node_type: "slider",
              label: "Profit Rate",
              min: 1,
              max: 15,
              step: 0.1,
              unit: "%",
              value: 4.5,
            },
            {
              node_id: "installment",
              node_type: "field",
              label: "Monthly Installment (Auto EMI)",
              field_type: "number",
              readonly: true,
              description: "Auto-calculated Monthly EMI (AED)",
              value: 15816,
            },
          ],
        },
        {
          node_id: "sec_property_details",
          node_type: "section",
          label: "Property Details",
          children: [
            {
              node_id: "isPropertyIdentified",
              node_type: "segment",
              label: "Whether Property Identified?",
              options: ["Yes", "No"],
              value: "Yes",
            },
            {
              node_id: "propertyAddressLine1",
              node_type: "field",
              label: "Property Address Line 1",
              field_type: "text",
              condition: "isPropertyIdentified === 'Yes'",
              placeholder: "Building / Plot No",
              value: "Marina Gate Tower 2, Apt 1804",
            },
            {
              node_id: "propertyEmirates",
              node_type: "field",
              label: "Property Emirate",
              field_type: "select",
              condition: "isPropertyIdentified === 'Yes'",
              options: [
                "Abu Dhabi",
                "Ajman",
                "Dubai",
                "Fujairah",
                "Ras Al Khaimah",
                "Sharjah",
                "Umm Al Quwain",
              ],
              value: "Dubai",
            },
            {
              node_id: "transactionAmount",
              node_type: "field",
              label: "Property Valuation / Purchase Price (AED)",
              field_type: "number",
              placeholder: "Enter property price",
              value: 3200000,
            },
            {
              node_id: "ownContribution",
              node_type: "field",
              label: "Own Down Payment Contribution (AED)",
              field_type: "number",
              placeholder: "Enter down payment amount",
              value: 700000,
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5 · Decision & Approval
    // ─────────────────────────────────────────────────────────────────────────
    {
      node_id: "tab_decision",
      node_type: "tab",
      label: "Decision & Sanction",
      children: [
        {
          node_id: "sec_underwriting_decision",
          node_type: "section",
          label: "Underwriting Sanction & Final Approval",
          children: [
            {
              node_id: "sanction_status",
              node_type: "field",
              label: "Sanction Status",
              field_type: "select",
              readonly: true,
              options: ["In Review", "Pre-Approved", "Sanctioned", "Declined"],
              value: "Pre-Approved",
            },
            {
              node_id: "underwriter_comments",
              node_type: "field",
              label: "Underwriter Notes",
              field_type: "textarea",
              readonly: true,
              value: "Applicant meets LTV 80% and DBR 35% threshold limits. Pre-approved subject to property valuation report.",
            },
            {
              node_id: "documentation_charges",
              node_type: "field",
              label: "Documentation & Admin Fee (AED)",
              field_type: "number",
              readonly: true,
              value: 2500,
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Extracts initial flat field values record from the default form tree
 */
export function extractInitialFieldValues(node: FormNode): Record<string, any> {
  const result: Record<string, any> = {};

  function traverse(n: FormNode) {
    if (n.value !== undefined && n.node_id) {
      result[n.node_id] = n.value;
    }
    if (n.children && n.children.length > 0) {
      n.children.forEach(traverse);
    }
  }

  traverse(node);
  return result;
}

export const defaultFieldValues: Record<string, any> = extractInitialFieldValues(defaultFormTree);

export const initialFormState: FormAgentState = {
  formTree: defaultFormTree,
  fieldValues: defaultFieldValues,
  selectedTab: "tab_consents",
  selectedNode: null,
  conversationHistory: [],
  lastAction: null,
  isProcessing: false,
  error: null,
};

export const defaultFormState = initialFormState;

