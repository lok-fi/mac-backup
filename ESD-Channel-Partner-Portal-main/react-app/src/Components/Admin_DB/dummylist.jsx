import { useEffect, useState } from "react";

export default function DummyList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/server/esd_channel_partner_function/")
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setRows(result.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p>Loading dummy table data...</p>;
  }

  return (
    <div className="dummy-list">
      <h2>Dummy Table Data</h2>

      {rows.length === 0 ? (
        <p>No data found</p>
      ) : (
        rows.map(row => (
          <div
            key={row.ROWID}
            style={{
              border: "1px solid #444",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "6px"
            }}
          >
            {Object.keys(row).map(key => (
              <p key={key}>
                <strong>{key}:</strong> {String(row[key])}
              </p>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
