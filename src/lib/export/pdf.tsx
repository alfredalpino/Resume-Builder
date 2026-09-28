import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { StructuredResume } from "@/lib/schema";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.3,
    color: "#111111",
  },
  name: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  headline: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#222222",
    marginBottom: 3,
  },
  contact: {
    fontSize: 8.5,
    textAlign: "center",
    marginBottom: 8,
    color: "#222222",
  },
  contactLink: {
    color: "#0B57D0",
    textDecoration: "none",
  },
  section: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    paddingBottom: 2,
  },
  body: {
    marginBottom: 2,
    textAlign: "justify",
  },
  jobHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    marginTop: 4,
    marginBottom: 1,
  },
  bullet: {
    marginLeft: 8,
    marginBottom: 1.5,
  },
  skillLabel: {
    fontFamily: "Helvetica-Bold",
  },
});

function ContactLine({ resume }: { resume: StructuredResume }) {
  const plain: string[] = [];
  if (resume.contact.location) plain.push(resume.contact.location);
  if (resume.contact.email) plain.push(resume.contact.email);
  if (resume.contact.phone) plain.push(resume.contact.phone);

  const nodes: React.ReactNode[] = [];
  if (plain.length) {
    nodes.push(<Text key="plain">{plain.join("  ·  ")}</Text>);
  }

  resume.contact.links.forEach((link, i) => {
    if (nodes.length || i > 0) {
      nodes.push(<Text key={`sep-${i}`}>{"  ·  "}</Text>);
    }
    nodes.push(
      <Link key={link.url} src={link.url} style={styles.contactLink}>
        {link.label}
      </Link>,
    );
  });

  return <Text style={styles.contact}>{nodes}</Text>;
}

function ResumeDocument({ resume }: { resume: StructuredResume }) {
  return (
    <Document
      title={`${resume.contact.fullName} Resume`}
      author={resume.contact.fullName}
      subject="ATS Resume"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.contact.fullName.toUpperCase()}</Text>
        {resume.headline ? (
          <Text style={styles.headline}>{resume.headline}</Text>
        ) : null}
        <ContactLine resume={resume} />

        {resume.summary ? (
          <View>
            <Text style={styles.section}>Professional Summary</Text>
            <Text style={styles.body}>{resume.summary}</Text>
          </View>
        ) : null}

        {resume.skills.length > 0 ? (
          <View>
            <Text style={styles.section}>Skills</Text>
            {resume.skills.map((g) => (
              <Text key={g.category} style={styles.body}>
                {`${g.category}: ${g.items.join(" · ")}`}
              </Text>
            ))}
          </View>
        ) : null}

        {resume.certifications.length > 0 ? (
          <View>
            <Text style={styles.section}>Certifications</Text>
            {resume.certifications.map((c) => (
              <Text key={c} style={styles.body}>
                {c}
              </Text>
            ))}
          </View>
        ) : null}

        {resume.experience.length > 0 ? (
          <View>
            <Text style={styles.section}>Professional Experience</Text>
            {resume.experience.map((job, idx) => (
              <View key={`${job.company}-${idx}`}>
                <Text style={styles.jobHeader}>
                  {`${job.company} — ${job.title}`}
                </Text>
                <Text style={{ fontSize: 9, marginBottom: 2, color: "#333" }}>
                  {`${job.start} – ${job.end}${job.location ? `  ·  ${job.location}` : ""}`}
                </Text>
                {job.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    {`• ${b}`}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {resume.projects.length > 0 ? (
          <View>
            <Text style={styles.section}>Projects</Text>
            {resume.projects.map((p, idx) => (
              <View key={`${p.name}-${idx}`}>
                <Text style={styles.jobHeader}>
                  {p.name}
                  {p.url ? "  ·  " : ""}
                  {p.url ? (
                    <Link src={p.url} style={styles.contactLink}>
                      {p.url.replace(/^https?:\/\//, "")}
                    </Link>
                  ) : null}
                </Text>
                {p.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    {`• ${b}`}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {resume.education.length > 0 ? (
          <View>
            <Text style={styles.section}>Education</Text>
            {resume.education.map((e, idx) => (
              <Text key={`${e.school}-${idx}`} style={styles.body}>
                {`${e.degree} — ${e.school}${e.dates ? `  ·  ${e.dates}` : ""}${e.details ? `  ·  ${e.details}` : ""}`}
              </Text>
            ))}
          </View>
        ) : null}

        {resume.extras && resume.extras.length > 0 ? (
          <View>
            <Text style={styles.section}>Additional</Text>
            {resume.extras.map((e) => (
              <Text key={e} style={styles.body}>
                {e}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function buildPdfBuffer(resume: StructuredResume): Promise<Buffer> {
  const instance = pdf(<ResumeDocument resume={resume} />);
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
