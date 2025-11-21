import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { PrebookingSuccessData } from "../email.types";

const primaryColor = "#7c3aed";
const successColor = "#10b981";
const textColor = "#1f2937";
const lightGray = "#f3f4f6";

export function PrebookingSuccessEmail(data: PrebookingSuccessData) {
  const confirmedDate = new Date(typeof data.confirmedAt === 'number' ? data.confirmedAt : data.confirmedAt);
  const confirmedTime = confirmedDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });

  return (
    <Html lang="es">
      <Head />
      <Body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          margin: 0,
          padding: 0,
          backgroundColor: "#f9fafb",
        }}
      >
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          {/* Header */}
          <Section
            style={{
              backgroundColor: primaryColor,
              padding: "32px 20px",
              textAlign: "center",
              borderRadius: "12px 12px 0 0",
            }}
          >
            <Heading
              style={{
                color: "white",
                margin: "0 0 8px 0",
                fontSize: "28px",
                fontWeight: "700",
              }}
            >
              ✅ Reserva Confirmada
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.9)", margin: 0 }}>
              Tu reserva ha sido realizada con éxito
            </Text>
          </Section>

          {/* Main Content */}
          <Section
            style={{
              backgroundColor: "white",
              padding: "32px 20px",
              borderRadius: "0 0 12px 12px",
              borderTop: `3px solid ${successColor}`,
            }}
          >
            {/* Class Details Card */}
            <Section
              style={{
                backgroundColor: lightGray,
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "24px",
                borderLeft: `4px solid ${primaryColor}`,
              }}
            >
              <Row>
                <Column>
                  <Text
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Clase
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "18px",
                      fontWeight: "600",
                      margin: "0 0 16px 0",
                    }}
                  >
                    {data.classType}
                  </Text>
                </Column>
              </Row>

              <Row>
                <Column>
                  <Text
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Fecha y Hora
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "16px",
                      margin: "0 0 16px 0",
                    }}
                  >
                    📅 {data.formattedDateTime}
                  </Text>
                </Column>
              </Row>

              {data.boxName && (
                <Row>
                  <Column>
                    <Text
                      style={{
                        color: "#6b7280",
                        fontSize: "12px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        margin: "0 0 4px 0",
                      }}
                    >
                      Box
                    </Text>
                    <Text
                      style={{
                        color: textColor,
                        fontSize: "16px",
                        margin: 0,
                      }}
                    >
                      🏋️ {data.boxName}
                    </Text>
                  </Column>
                </Row>
              )}
            </Section>

            {/* Confirmation Details */}
            <Section style={{ marginBottom: "24px" }}>
              <Text
                style={{
                  color: textColor,
                  fontSize: "14px",
                  lineHeight: "1.6",
                  margin: "0 0 12px 0",
                }}
              >
                <strong>Hora de confirmación:</strong> {confirmedTime}
              </Text>

              {data.alreadyBookedManually && (
                <Text
                  style={{
                    color: "#f59e0b",
                    backgroundColor: "#fef3c7",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    margin: 0,
                  }}
                >
                  ℹ️ Nota: Ya tenías esta clase reservada manualmente.
                </Text>
              )}
            </Section>

            {/* Footer Info */}
            <Section
              style={{
                backgroundColor: lightGray,
                padding: "16px",
                borderRadius: "6px",
                textAlign: "center",
              }}
            >
              <Text
                style={{
                  color: "#6b7280",
                  fontSize: "13px",
                  margin: 0,
                  lineHeight: "1.5",
                }}
              >
                Si tienes alguna pregunta o necesitas cambiar tu reserva,
                <br />
                por favor accede a tu cuenta en AimHarder.
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section
            style={{
              textAlign: "center",
              padding: "20px",
              backgroundColor: "#f9fafb",
            }}
          ></Section>
        </Container>
      </Body>
    </Html>
  );
}
