/**
 * ZMK Battery History - Main Application
 * Displays battery consumption history for keyboard devices
 */

import { useContext, useState } from "react";
import "./App.css";
import { connect as serial_connect } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";
import {
  ZMKConnection,
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  BatteryHistoryEntry,
} from "./proto/zmk/template/custom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Custom subsystem identifier - must match firmware registration
export const SUBSYSTEM_IDENTIFIER = "zmk__battery_history";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🔋 ZMK Battery History</h1>
        <p>Track your keyboard's battery consumption over time</p>
      </header>

      <ZMKConnection
        renderDisconnected={({ connect, isLoading, error }) => (
          <section className="card">
            <h2>Device Connection</h2>
            {isLoading && <p>⏳ Connecting...</p>}
            {error && (
              <div className="error-message">
                <p>🚨 {error}</p>
              </div>
            )}
            {!isLoading && (
              <button
                className="btn btn-primary"
                onClick={() => connect(serial_connect)}
              >
                🔌 Connect Serial
              </button>
            )}
          </section>
        )}
        renderConnected={({ disconnect, deviceName }) => (
          <>
            <section className="card">
              <h2>Device Connection</h2>
              <div className="device-info">
                <h3>✅ Connected to: {deviceName}</h3>
              </div>
              <button className="btn btn-secondary" onClick={disconnect}>
                Disconnect
              </button>
            </section>

            <BatteryHistorySection />
          </>
        )}
      />

      <footer className="app-footer">
        <p>
          <strong>ZMK Battery History</strong> - Monitor battery consumption
          and optimize your keyboard usage
        </p>
      </footer>
    </div>
  );
}

interface BatteryHistoryData {
  entries: BatteryHistoryEntry[];
  currentBattery: number;
  totalEntries: number;
}

export function BatteryHistorySection() {
  const zmkApp = useContext(ZMKAppContext);
  const [historyData, setHistoryData] = useState<BatteryHistoryData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!zmkApp) return null;

  const subsystem = zmkApp.findSubsystem(SUBSYSTEM_IDENTIFIER);

  // Fetch battery history from device
  const fetchHistory = async () => {
    if (!zmkApp.state.connection || !subsystem) return;

    setIsLoading(true);
    setError(null);

    try {
      const service = new ZMKCustomSubsystem(
        zmkApp.state.connection,
        subsystem.index
      );

      const request = Request.create({
        getBatteryHistory: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);

        if (resp.batteryHistory) {
          setHistoryData({
            entries: resp.batteryHistory.entries,
            currentBattery: resp.batteryHistory.currentBattery,
            totalEntries: resp.batteryHistory.totalEntries,
          });
          setError(null);
        } else if (resp.error) {
          setError(`Error: ${resp.error.message}`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch battery history:", err);
      setError(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Clear battery history
  const clearHistory = async () => {
    if (!zmkApp.state.connection || !subsystem) return;

    if (
      !confirm(
        "Are you sure you want to clear all battery history? This cannot be undone."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = new ZMKCustomSubsystem(
        zmkApp.state.connection,
        subsystem.index
      );

      const request = Request.create({
        clearBatteryHistory: {},
      });

      const payload = Request.encode(request).finish();
      const responsePayload = await service.callRPC(payload);

      if (responsePayload) {
        const resp = Response.decode(responsePayload);

        if (resp.clearBatteryHistory?.success) {
          setHistoryData(null);
          alert("Battery history cleared successfully!");
        } else if (resp.error) {
          setError(`Error: ${resp.error.message}`);
        }
      }
    } catch (err) {
      console.error("Failed to clear battery history:", err);
      setError(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!subsystem) {
    return (
      <section className="card">
        <div className="warning-message">
          <p>
            ⚠️ Subsystem "{SUBSYSTEM_IDENTIFIER}" not found. Make sure your
            firmware includes the battery history module.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card battery-history-section">
      <h2>Battery History</h2>

      <div className="controls">
        <button
          className="btn btn-primary"
          disabled={isLoading}
          onClick={fetchHistory}
        >
          {isLoading ? "⏳ Loading..." : "📊 Fetch History"}
        </button>
        <button
          className="btn btn-danger"
          disabled={isLoading || !historyData}
          onClick={clearHistory}
        >
          🗑️ Clear History
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {historyData && (
        <>
          <div className="battery-stats">
            <div className="stat-card">
              <h3>Current Battery</h3>
              <div className="stat-value">
                {historyData.currentBattery}%
                <div
                  className="battery-bar"
                  style={{
                    width: `${historyData.currentBattery}%`,
                    backgroundColor:
                      historyData.currentBattery > 50
                        ? "#4caf50"
                        : historyData.currentBattery > 20
                          ? "#ff9800"
                          : "#f44336",
                  }}
                />
              </div>
            </div>
            <div className="stat-card">
              <h3>Data Points</h3>
              <div className="stat-value">{historyData.totalEntries}</div>
            </div>
            <div className="stat-card">
              <h3>Time Range</h3>
              <div className="stat-value">
                {historyData.entries.length > 0
                  ? formatTimeRange(
                      historyData.entries[0].timestamp,
                      historyData.entries[historyData.entries.length - 1]
                        .timestamp
                    )
                  : "No data"}
              </div>
            </div>
          </div>

          {historyData.entries.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={historyData.entries.map((entry) => ({
                    time: formatTimestamp(entry.timestamp),
                    battery: entry.batteryPercentage,
                    timestamp: entry.timestamp,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis
                    dataKey="time"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    stroke="#fff"
                  />
                  <YAxis
                    domain={[0, 100]}
                    label={{
                      value: "Battery %",
                      angle: -90,
                      position: "insideLeft",
                    }}
                    stroke="#fff"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#2a2a2a",
                      border: "1px solid #646cff",
                    }}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="battery"
                    stroke="#646cff"
                    strokeWidth={2}
                    dot={{ fill: "#646cff", r: 4 }}
                    name="Battery Level (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="info-message">
              <p>
                No battery history data available. The device will record
                battery levels over time.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function formatTimestamp(timestamp: number): string {
  // Convert seconds to hours for uptime display
  const hours = Math.floor(timestamp / 3600);
  const minutes = Math.floor((timestamp % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatTimeRange(start: number, end: number): string {
  const duration = end - start;
  const days = Math.floor(duration / 86400);
  const hours = Math.floor((duration % 86400) / 3600);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h`;
}

export default App;
