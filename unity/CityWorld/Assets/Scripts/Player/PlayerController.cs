using UnityEngine;
using CityWorld.Core;
using CityWorld.Vehicles;

namespace CityWorld.Player
{
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour, IDamageable
    {
        [Header("Movement")]
        [SerializeField] private float walkSpeed = 5.2f;
        [SerializeField] private float sprintSpeed = 9.8f;
        [SerializeField] private float swimSpeed = 4.2f;
        [SerializeField] private float jumpHeight = 1.6f;
        [SerializeField] private float gravity = -21f;
        [SerializeField] private float rotationSmoothTime = 0.1f;

        [Header("Vitals")]
        [SerializeField] private float maxHealth = 100f;
        [SerializeField] private float maxArmor = 100f;
        [SerializeField] private float maxStamina = 100f;
        [SerializeField] private float waterLevelY = -0.35f;

        [Header("References")]
        [SerializeField] private Transform cameraTransform;
        [SerializeField] private Transform respawnPoint;

        private CharacterController controller;
        private Vector3 velocity;
        private float turnVelocity;
        private float peakAirY;
        private bool wasGrounded;

        public float CurrentHealth { get; private set; }
        public float MaxHealth => maxHealth;
        public float CurrentArmor { get; private set; } = 50f;
        public float CurrentStamina { get; private set; }
        public bool IsSwimming { get; private set; }
        public VehicleController ActiveVehicle { get; private set; }

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
            CurrentHealth = maxHealth;
            CurrentStamina = maxStamina;
        }

        private void Update()
        {
            if (ActiveVehicle != null)
            {
                if (Input.GetKeyDown(KeyCode.F)) ExitVehicle();
                return;
            }

            HandleMovement();
            HandleInteraction();
        }

        private void HandleMovement()
        {
            IsSwimming = transform.position.y < waterLevelY - 0.55f;
            float h = Input.GetAxisRaw("Horizontal");
            float v = Input.GetAxisRaw("Vertical");
            Vector3 inputDir = new Vector3(h, 0f, v).normalized;

            bool wantsSprint = Input.GetKey(KeyCode.LeftShift) && CurrentStamina > 2f && !IsSwimming;
            if (wantsSprint && inputDir.sqrMagnitude > 0.01f)
                CurrentStamina = Mathf.Max(0f, CurrentStamina - 18f * Time.deltaTime);
            else
                CurrentStamina = Mathf.Min(maxStamina, CurrentStamina + 14f * Time.deltaTime);

            float targetSpeed = IsSwimming ? swimSpeed : (wantsSprint ? sprintSpeed : walkSpeed);

            if (inputDir.sqrMagnitude >= 0.01f)
            {
                float targetAngle = Mathf.Atan2(inputDir.x, inputDir.z) * Mathf.Rad2Deg + cameraTransform.eulerAngles.y;
                float smoothAngle = Mathf.SmoothDampAngle(transform.eulerAngles.y, targetAngle, ref turnVelocity, rotationSmoothTime);
                transform.rotation = Quaternion.Euler(0f, smoothAngle, 0f);

                Vector3 moveDir = Quaternion.Euler(0f, targetAngle, 0f) * Vector3.forward;
                controller.Move(moveDir.normalized * targetSpeed * Time.deltaTime);
            }

            if (IsSwimming)
            {
                float targetY = waterLevelY - 0.85f;
                velocity.y = (targetY - transform.position.y) * 4f;
                peakAirY = transform.position.y;
            }
            else
            {
                if (controller.isGrounded)
                {
                    if (!wasGrounded)
                    {
                        float drop = peakAirY - transform.position.y;
                        if (drop > 6.5f) TakeDamage((drop - 6f) * 9f, transform.position);
                    }
                    velocity.y = -2f;
                    peakAirY = transform.position.y;
                    if (Input.GetButtonDown("Jump")) velocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);
                }
                else
                {
                    if (transform.position.y > peakAirY) peakAirY = transform.position.y;
                    velocity.y += gravity * Time.deltaTime;
                }
            }

            wasGrounded = controller.isGrounded;
            controller.Move(velocity * Time.deltaTime);
        }

        private void HandleInteraction()
        {
            if (Input.GetKeyDown(KeyCode.F))
            {
                Collider[] hits = Physics.OverlapSphere(transform.position, 4.2f);
                foreach (var hit in hits)
                {
                    if (hit.TryGetComponent<VehicleController>(out var vehicle))
                    {
                        EnterVehicle(vehicle);
                        return;
                    }
                }
            }

            if (Input.GetKeyDown(KeyCode.E))
            {
                Collider[] hits = Physics.OverlapSphere(transform.position, 3.2f);
                foreach (var hit in hits)
                {
                    if (hit.TryGetComponent<IInteractable>(out var interactable))
                    {
                        interactable.Interact(gameObject);
                        return;
                    }
                }
            }
        }

        public void EnterVehicle(VehicleController vehicle)
        {
            ActiveVehicle = vehicle;
            vehicle.SetPlayerDriver(true);
            controller.enabled = false;
            SetRenderersActive(false);
        }

        public void ExitVehicle()
        {
            if (ActiveVehicle == null) return;
            transform.position = ActiveVehicle.GetExitPoint();
            ActiveVehicle.SetPlayerDriver(false);
            ActiveVehicle = null;
            controller.enabled = true;
            SetRenderersActive(true);
        }

        private void SetRenderersActive(bool state)
        {
            foreach (var r in GetComponentsInChildren<Renderer>()) r.enabled = state;
        }

        public void TakeDamage(float amount, Vector3 hitPoint)
        {
            float rem = amount;
            if (CurrentArmor > 0f)
            {
                float absorbed = Mathf.Min(CurrentArmor, rem * 0.7f);
                CurrentArmor -= absorbed;
                rem -= absorbed;
            }
            CurrentHealth = Mathf.Max(0f, CurrentHealth - rem);
            if (CurrentHealth <= 0f) Respawn();
        }

        private void Respawn()
        {
            if (ActiveVehicle != null) ExitVehicle();
            CurrentHealth = maxHealth;
            CurrentStamina = maxStamina;
            if (respawnPoint != null)
            {
                controller.enabled = false;
                transform.position = respawnPoint.position;
                controller.enabled = true;
            }
        }
    }
}
