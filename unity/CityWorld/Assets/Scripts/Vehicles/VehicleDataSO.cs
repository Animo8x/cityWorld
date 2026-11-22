using UnityEngine;

namespace CityWorld.Vehicles
{
    public enum VehicleCategory
    {
        Compact, Sedan, SUV, Sports, Luxury, Truck, Van, Bus, Motorcycle, Police
    }

    [CreateAssetMenu(fileName = "VehicleData", menuName = "CityWorld/Vehicle Data")]
    public class VehicleDataSO : ScriptableObject
    {
        public string vehicleName = "Metro Cruiser";
        public VehicleCategory category = VehicleCategory.Sedan;
        public float mass = 1450f;
        public float motorTorque = 1800f;
        public float brakeTorque = 3200f;
        public float maxSteerAngle = 32f;
        public float maxSpeedKmh = 140f;
        public float downforce = 80f;
    }
}
