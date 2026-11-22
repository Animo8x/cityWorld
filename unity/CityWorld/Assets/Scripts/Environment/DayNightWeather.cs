using UnityEngine;

namespace CityWorld.Environment
{
    public enum WeatherCondition { Clear, Cloudy, Rain, Fog }

    public class DayNightWeather : MonoBehaviour
    {
        [Header("Time of Day")]
        [Range(0f, 24f)] public float timeOfDay = 10.5f;
        [SerializeField] private float dayCycleSpeed = 0.15f;
        [SerializeField] private Light sunLight;
        [SerializeField] private Gradient skyTint;
        [SerializeField] private Material[] streetLampMaterials;

        [Header("Weather")]
        public WeatherCondition currentWeather = WeatherCondition.Clear;
        [SerializeField] private ParticleSystem rainParticles;
        [SerializeField] private AudioSource rainAudio;
        [SerializeField] private Material wetRoadMaterial;

        public bool IsNight => timeOfDay < 6f || timeOfDay >= 19.5f;

        private void Update()
        {
            timeOfDay = (timeOfDay + dayCycleSpeed * Time.deltaTime) % 24f;
            float sunAngle = ((timeOfDay - 6f) / 24f) * 360f;
            if (sunLight != null)
            {
                sunLight.transform.rotation = Quaternion.Euler(sunAngle, 170f, 0f);
                float daylight = Mathf.Clamp01(Mathf.Sin(((timeOfDay - 6f) / 24f) * Mathf.PI * 2f) + 0.2f);
                sunLight.intensity = Mathf.Lerp(0.15f, 1.8f, daylight);
            }

            UpdateWeatherEffects();
        }

        public void SetWeather(WeatherCondition condition) => currentWeather = condition;

        private void UpdateWeatherEffects()
        {
            bool raining = currentWeather == WeatherCondition.Rain;
            if (rainParticles != null)
            {
                if (raining && !rainParticles.isPlaying) rainParticles.Play();
                else if (!raining && rainParticles.isPlaying) rainParticles.Stop();
            }
            if (rainAudio != null) rainAudio.volume = Mathf.Lerp(rainAudio.volume, raining ? 0.65f : 0f, Time.deltaTime * 2f);
            if (wetRoadMaterial != null) wetRoadMaterial.SetFloat("_Smoothness", raining ? 0.85f : 0.22f);
            RenderSettings.fogDensity = currentWeather == WeatherCondition.Fog ? 0.015f : (raining ? 0.006f : 0.002f);
        }
    }
}
