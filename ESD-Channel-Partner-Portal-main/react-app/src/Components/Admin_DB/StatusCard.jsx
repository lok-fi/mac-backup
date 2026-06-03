const StatusCard = ({ title, value }) => {
  return (
    <div className="bg-gradient-to-r from-orange-200 to-orange-300 rounded-xl shadow p-6 flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-bold">{value}</h2>
        <p className="text-sm">{title}</p>
      </div>
      <div className="text-white text-4xl opacity-80">👥</div>
    </div>
  );
};

export default StatusCard;
