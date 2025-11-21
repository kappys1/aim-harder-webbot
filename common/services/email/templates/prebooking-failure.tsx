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
import { PrebookingFailureData } from "../email.types";

const errorColor = "#ef4444";
const primaryColor = "#7c3aed";
const textColor = "#1f2937";
const lightGray = "#f3f4f6";
const dangerBg = "#fee2e2";

export function PrebookingFailureEmail(data: PrebookingFailureData) {
  const isUserEmail = !data.userEmail.includes("alexsbd1");

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
              backgroundColor: errorColor,
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
              ❌ Error en tu Reserva
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.9)", margin: 0 }}>
              No pudimos completar tu reserva automática
            </Text>
          </Section>

          {/* Main Content */}
          <Section
            style={{
              backgroundColor: "white",
              padding: "32px 20px",
              borderRadius: "0 0 12px 12px",
              borderTop: `3px solid ${errorColor}`,
            }}
          >
            {isUserEmail ? (
              <>
                {/* For User: Simple, actionable message */}
                <Section style={{ marginBottom: "24px" }}>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "16px",
                      lineHeight: "1.6",
                      margin: "0 0 16px 0",
                    }}
                  >
                    Hola,
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "16px",
                      lineHeight: "1.6",
                      margin: "0 0 16px 0",
                    }}
                  >
                    Lamentablemente, no pudimos reservar tu plaza de forma
                    automática en el intento inicial.
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "16px",
                      lineHeight: "1.6",
                      margin: "0 0 16px 0",
                    }}
                  >
                    <strong>Motivo del error:</strong> {data.errorMessage}
                  </Text>
                  <Text
                    style={{
                      color: "#d97706",
                      fontSize: "15px",
                      lineHeight: "1.6",
                      margin: "0 0 16px 0",
                      fontWeight: "600",
                    }}
                  >
                    ⚠️ El sistema reintentará automáticamente hasta 2 veces más.
                  </Text>
                </Section>

                {/* Class Details Card */}
                <Section
                  style={{
                    backgroundColor: lightGray,
                    padding: "20px",
                    borderRadius: "8px",
                    marginBottom: "24px",
                    borderLeft: `4px solid ${errorColor}`,
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
                          margin: 0,
                        }}
                      >
                        📅 {data.formattedDateTime}
                      </Text>
                    </Column>
                  </Row>
                </Section>

                {/* Call to Action */}
                <Section style={{ marginBottom: "24px" }}>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "16px",
                      lineHeight: "1.6",
                      margin: "0 0 16px 0",
                      fontWeight: "600",
                    }}
                  >
                    ¿Qué puedes hacer?
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "15px",
                      lineHeight: "1.6",
                      margin: "0 0 12px 0",
                    }}
                  >
                    Por favor, intenta reservar esta clase manualmente en
                    AimHarder. A veces el error es temporal y conseguirás tu
                    plaza sin problemas.
                  </Text>
                </Section>

                {/* Support */}
                <Section
                  style={{
                    backgroundColor: dangerBg,
                    padding: "16px",
                    borderRadius: "6px",
                  }}
                >
                  <Text
                    style={{
                      color: "#7f1d1d",
                      fontSize: "13px",
                      margin: 0,
                      lineHeight: "1.5",
                    }}
                  >
                    Si el problema persiste, por favor contacta con el equipo de
                    Aim Wod Bot.
                  </Text>
                </Section>
              </>
            ) : (
              <>
                {/* For Admin: Detailed traceability information */}
                <Section style={{ marginBottom: "24px" }}>
                  <Heading
                    style={{
                      color: textColor,
                      fontSize: "18px",
                      margin: "0 0 16px 0",
                      fontWeight: "600",
                    }}
                  >
                    📋 Detalles Técnicos (Monitoreo Interno)
                  </Heading>
                </Section>

                {/* User & Class Info */}
                <Section
                  style={{
                    backgroundColor: lightGray,
                    padding: "16px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <Text
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: "600",
                      margin: "0 0 8px 0",
                    }}
                  >
                    INFORMACIÓN DEL USUARIO
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "14px",
                      margin: "0 0 4px 0",
                    }}
                  >
                    <strong>Email:</strong> {data.userEmail}
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "14px",
                      margin: "0 0 4px 0",
                    }}
                  >
                    <strong>Clase:</strong> {data.classType}
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "14px",
                      margin: "0 0 4px 0",
                    }}
                  >
                    <strong>Horario:</strong> {data.formattedDateTime}
                  </Text>
                  {data.boxName && (
                    <Text
                      style={{ color: textColor, fontSize: "14px", margin: 0 }}
                    >
                      <strong>Box:</strong> {data.boxName}
                    </Text>
                  )}
                </Section>

                {/* Error Information */}
                <Section
                  style={{
                    backgroundColor: dangerBg,
                    padding: "16px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    borderLeft: `4px solid ${errorColor}`,
                  }}
                >
                  <Text
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      fontWeight: "600",
                      margin: "0 0 8px 0",
                    }}
                  >
                    ERROR
                  </Text>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: "14px",
                      margin: "0 0 4px 0",
                    }}
                  >
                    <strong>Mensaje:</strong> {data.errorMessage}
                  </Text>
                  {data.errorCode && (
                    <Text
                      style={{ color: textColor, fontSize: "14px", margin: 0 }}
                    >
                      <strong>Código:</strong> {data.errorCode}
                    </Text>
                  )}
                </Section>

                {/* Timing Information */}
                {(data.preparedAt || data.firedAt || data.respondedAt) && (
                  <Section
                    style={{
                      backgroundColor: lightGray,
                      padding: "16px",
                      borderRadius: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    <Text
                      style={{
                        color: "#6b7280",
                        fontSize: "12px",
                        fontWeight: "600",
                        margin: "0 0 8px 0",
                      }}
                    >
                      CRONOLOGÍA DE LA SOLICITUD
                    </Text>
                    {data.preparedAt && (
                      <Text
                        style={{
                          color: textColor,
                          fontSize: "13px",
                          margin: "0 0 4px 0",
                        }}
                      >
                        🔧 Preparado: {formatTime(data.preparedAt)}
                      </Text>
                    )}
                    {data.firedAt && (
                      <Text
                        style={{
                          color: textColor,
                          fontSize: "13px",
                          margin: "0 0 4px 0",
                        }}
                      >
                        🚀 Lanzado: {formatTime(data.firedAt)}
                      </Text>
                    )}
                    {data.respondedAt && (
                      <Text
                        style={{
                          color: textColor,
                          fontSize: "13px",
                          margin: "0 0 4px 0",
                        }}
                      >
                        ✉️ Respuesta: {formatTime(data.respondedAt)}
                      </Text>
                    )}
                    {data.fireLatency !== undefined && (
                      <Text
                        style={{
                          color: textColor,
                          fontSize: "13px",
                          margin: "0 0 4px 0",
                        }}
                      >
                        ⏱️ Latencia: {data.fireLatency}ms
                      </Text>
                    )}
                  </Section>
                )}

                {/* Technical Details */}
                {data.technicalDetails && (
                  <Section
                    style={{
                      backgroundColor: lightGray,
                      padding: "16px",
                      borderRadius: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    <Text
                      style={{
                        color: "#6b7280",
                        fontSize: "12px",
                        fontWeight: "600",
                        margin: "0 0 8px 0",
                      }}
                    >
                      DETALLES DE AIMHARDER
                    </Text>
                    {data.technicalDetails.bookState && (
                      <Text
                        style={{
                          color: textColor,
                          fontSize: "13px",
                          margin: "0 0 4px 0",
                        }}
                      >
                        <strong>Estado:</strong>{" "}
                        {data.technicalDetails.bookState}
                      </Text>
                    )}
                    {data.technicalDetails.errorMssg && (
                      <Text
                        style={{
                          color: textColor,
                          fontSize: "13px",
                          margin: "0 0 4px 0",
                        }}
                      >
                        <strong>Error AimHarder:</strong>{" "}
                        {data.technicalDetails.errorMssg}
                      </Text>
                    )}
                    {data.technicalDetails.errorMssgLang && (
                      <Text
                        style={{
                          color: textColor,
                          fontSize: "13px",
                          margin: "0 0 4px 0",
                        }}
                      >
                        <strong>Código Error:</strong>{" "}
                        {data.technicalDetails.errorMssgLang}
                      </Text>
                    )}
                    {data.technicalDetails.responseTime && (
                      <Text
                        style={{
                          color: textColor,
                          fontSize: "13px",
                          margin: "0 0 4px 0",
                        }}
                      >
                        <strong>Tiempo Respuesta:</strong>{" "}
                        {data.technicalDetails.responseTime}ms
                      </Text>
                    )}
                  </Section>
                )}

                {/* Execution ID */}
                {data.executionId && (
                  <Section
                    style={{
                      backgroundColor: lightGray,
                      padding: "12px",
                      borderRadius: "6px",
                      textAlign: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#6b7280",
                        fontSize: "12px",
                        margin: "0 0 4px 0",
                      }}
                    >
                      ID de Ejecución para logs
                    </Text>
                    <Text
                      style={{
                        color: textColor,
                        fontSize: "13px",
                        fontFamily: "monospace",
                        margin: 0,
                        wordBreak: "break-all",
                      }}
                    >
                      {data.executionId}
                    </Text>
                  </Section>
                )}
              </>
            )}
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

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
}
