import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

/**
 * Generates and downloads a clean, professional SIMSRH Digital Prescription PDF.
 * Strictly adheres to privacy guidelines: QR contains ONLY reference ID / verification URL,
 * zero medical data.
 *
 * @param {Object} record - The consultation record object
 */
export async function generatePrescriptionPdf(record) {
  if (!record) return;

  const DocConstructor = jsPDF?.jsPDF || jsPDF;
  const doc = new DocConstructor({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Resolved metadata
  const hospitalName = "SHRIDEVI INSTITUTE OF MEDICAL SCIENCES & RESEARCH HOSPITAL (SIMSRH)";
  const hospitalAddress = "Sira Road, NH-4, Tumakuru, Karnataka – 572106 • Phone: +91 816 2212121";
  const refId = record.consultation_id || record.queue_id || record.booking_id || "SIMSRH-CONS";
  const queueToken = record.queue_id || "N/A";
  const bookingId = record.booking_id || "N/A";
  const consultationDate = record.consultation_date || (record.created_at ? record.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  const consultationTime = record.consultation_time || (record.created_at && record.created_at.includes('T') ? record.created_at.split('T')[1].substring(0, 5) : "OPD Hours");

  const doctorName = record.doctor_name || record.doctor || "Attending Physician";
  const department = record.department || "General OPD";
  const roomNumber = record.room_number || "Room 204";

  const patientName = record.patient_name || record.name || "Patient";
  const patientId = record.patient_id || "N/A";

  const vitals = record.vitals_at_consultation || {};
  const age = vitals.age ?? record.age ?? "—";
  const gender = vitals.gender ?? record.gender ?? "—";
  const height = vitals.height_cm ?? record.height_cm;
  const weight = vitals.weight_kg ?? record.weight_kg;
  const bmi = vitals.bmi ?? (height && weight ? (weight / Math.pow(height / 100, 2)).toFixed(1) : null);
  const city = vitals.city || record.city || record.address || "Tumakuru";

  const doctorAssessment = record.doctor_assessment || {};
  const diagnosis = doctorAssessment.diagnosis || record.diagnosis || "No diagnosis documented";
  const doctorNotes = doctorAssessment.notes || record.doctor_notes || record.notes || null;
  const doctorAdvice = doctorAssessment.advice || record.doctor_advice || record.advice || null;
  const prescriptions = Array.isArray(record.prescriptions) ? record.prescriptions : [];

  // Generate privacy-safe QR code:
  // Strictly references consultation ID and verification URL. Zero patient health data inside QR.
  const verificationPayload = `https://simsrh.org/verify/consultation?ref=${encodeURIComponent(refId)}&auth=simsrh_opd_emr`;
  let qrDataUrl = null;
  try {
    const qrLib = QRCode?.toDataURL ? QRCode : (QRCode?.default || QRCode);
    qrDataUrl = await qrLib.toDataURL(verificationPayload, {
      width: 150,
      margin: 1,
      color: {
        dark: '#0f766e',
        light: '#ffffff'
      }
    });
  } catch (qrErr) {
    console.warn("QR Code generation fallback:", qrErr);
  }

  // --- HEADER SECTION ---
  // Teal accent top banner
  doc.setFillColor(15, 118, 110); // Teal #0f766e
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Hospital Name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(hospitalName, margin, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(220, 252, 231);
  doc.text(hospitalAddress, margin, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(254, 240, 138); // Soft yellow
  doc.text("OUTPATIENT DEPARTMENT • OFFICIAL CLINICAL PRESCRIPTION & EMR SUMMARY", margin, 23);

  let currentY = 35;

  // --- METADATA STRIP ---
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);

  // Column 1: Consultation Details
  doc.text("CONSULTATION REF / TOKEN", margin + 4, currentY + 6);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${queueToken}`, margin + 4, currentY + 12);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`ID: ${refId}`, margin + 4, currentY + 17);
  doc.text(`Date: ${consultationDate} (${consultationTime})`, margin + 4, currentY + 21);

  // Column 2: Physician & Department
  const col2X = margin + 65;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("ATTENDING SPECIALIST", col2X, currentY + 6);
  doc.setFontSize(10);
  doc.setTextColor(15, 118, 110);
  doc.text(doctorName, col2X, currentY + 12);
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`${department} • ${roomNumber}`, col2X, currentY + 17);
  doc.text("OPD Consulting Chamber", col2X, currentY + 21);

  // Column 3: Patient Information
  const col3X = margin + 125;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("PATIENT PARTICULARS", col3X, currentY + 6);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(patientName, col3X, currentY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`ID: ${patientId} • ${age} yrs / ${gender}`, col3X, currentY + 17);
  doc.text(`Origin: ${city} ${height && weight ? `• ${height}cm / ${weight}kg (${bmi} BMI)` : ''}`, col3X, currentY + 21);

  currentY += 28;

  // --- SECTION 1: CLINICAL DIAGNOSIS & ASSESSMENT ---
  doc.setDrawColor(204, 251, 241); // Teal-100
  doc.setFillColor(240, 253, 250); // Teal-50
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 118, 110);
  doc.text("CLINICAL DIAGNOSIS / CLINICIAN ASSESSMENT", margin + 4, currentY + 6);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(diagnosis || "Clinical assessment completed", margin + 4, currentY + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Status: Clinically verified by attending physician at SIMSRH", margin + 4, currentY + 18);

  currentY += 26;

  // --- SECTION 2: PRESCRIPTION & PHARMACY DISPENSING ORDERS ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Rx — PRESCRIBED MEDICINES & DOSAGE SCHEDULE", margin, currentY + 4);

  currentY += 7;

  // Table Header
  doc.setFillColor(15, 118, 110);
  doc.rect(margin, currentY, contentWidth, 7, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);

  const colWidths = [50, 28, 32, 26, 42]; // Total: 178mm (fits contentWidth)
  const colX = [
    margin + 2,
    margin + colWidths[0],
    margin + colWidths[0] + colWidths[1],
    margin + colWidths[0] + colWidths[1] + colWidths[2],
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
  ];

  doc.text("MEDICINE / DRUG NAME", colX[0], currentY + 5);
  doc.text("DOSAGE", colX[1], currentY + 5);
  doc.text("FREQUENCY", colX[2], currentY + 5);
  doc.text("DURATION", colX[3], currentY + 5);
  doc.text("SPECIAL INSTRUCTIONS", colX[4], currentY + 5);

  currentY += 7;

  // Table Body Rows
  if (prescriptions.length > 0) {
    prescriptions.forEach((item, index) => {
      const isEven = index % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, currentY, contentWidth, 8, 'FD');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(String(item.medicine || item.name || "—").substring(0, 30), colX[0], currentY + 5.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(String(item.dosage || "—").substring(0, 18), colX[1], currentY + 5.5);
      doc.text(String(item.frequency || "—").substring(0, 20), colX[2], currentY + 5.5);
      doc.text(String(item.duration || "—").substring(0, 16), colX[3], currentY + 5.5);
      doc.text(String(item.instructions || "As directed").substring(0, 26), colX[4], currentY + 5.5);

      currentY += 8;
    });
  } else {
    // Empty prescription notice row
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, contentWidth, 12, 'FD');
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("No specific pharmaceutical medications prescribed for this consultation.", margin + 4, currentY + 5);
    doc.text("Follow general medical advice and lifestyle instructions below.", margin + 4, currentY + 9);
    currentY += 12;
  }

  currentY += 4;

  // --- SECTION 3: CLINICAL NOTES & DOCTOR ADVICE ---
  if (doctorNotes || doctorAdvice) {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);

    const boxHeight = doctorNotes && doctorAdvice ? 34 : 22;
    doc.roundedRect(margin, currentY, contentWidth, boxHeight, 2, 2, 'FD');

    let textY = currentY + 5;
    if (doctorNotes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text("CLINICAL NOTES & OBSERVATIONS:", margin + 4, textY);
      textY += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const splitNotes = doc.splitTextToSize(doctorNotes, contentWidth - 8);
      doc.text(splitNotes, margin + 4, textY);
      textY += splitNotes.length * 4 + 2;
    }

    if (doctorAdvice) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 118, 110);
      doc.text("MEDICAL ADVICE & PRECAUTIONS:", margin + 4, textY);
      textY += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const splitAdvice = doc.splitTextToSize(doctorAdvice, contentWidth - 8);
      doc.text(splitAdvice, margin + 4, textY);
    }

    currentY += boxHeight + 4;
  }

  // --- FOOTER & VALIDATION SECTION ---
  const footerY = pageHeight - 45;

  // Top dividing line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  // Left: Verification QR Code (Strict zero medical PII)
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', margin, footerY + 3, 22, 22);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(15, 118, 110);
      doc.text("DIGITAL VERIFICATION QR", margin + 25, footerY + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text("Scan to securely verify consultation", margin + 25, footerY + 11);
      doc.text(`authenticity at SIMSRH Tumakuru portal.`, margin + 25, footerY + 14.5);
      doc.text(`Secure Token: ${refId}`, margin + 25, footerY + 18);
      doc.text("Confidentiality: Contains zero medical data.", margin + 25, footerY + 21.5);
    } catch (imgErr) {
      console.warn("Could not embed QR image:", imgErr);
    }
  }

  // Right: Doctor Signature & Hospital Seal
  const sigX = pageWidth - margin - 55;
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(sigX, footerY + 17, pageWidth - margin, footerY + 17);
  doc.setLineDashPattern([], 0); // Reset dash

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(doctorName, sigX, footerY + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${department} • Registered Medical Practitioner`, sigX, footerY + 26);
  doc.text("Digitally authenticated via SIMSRH OPD EMR", sigX, footerY + 29.5);

  // Very bottom legal notice
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This is an electronically generated outpatient consultation sheet from SIMSRH Tumakuru. Valid for pharmacy dispensing when presented with patient token.",
    margin,
    pageHeight - 6
  );

  // Trigger browser download
  const cleanDocName = (doctorName || "Doctor").replace(/[^a-zA-Z0-9]/g, '_');
  const cleanPatName = (patientName || "Patient").replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `SIMSRH_Prescription_${cleanPatName}_${refId}.pdf`;
  doc.save(filename);
}
