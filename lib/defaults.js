export const DEFAULT_USERS = {
  student: [
    { name: "Riya Sharma", mobile: "9876543210", password: "student123" },
  ],
  canteen: [
    { name: "Canteen Manager", mobile: "9123456780", password: "staff123" },
  ],
};

export const DEFAULT_TIME_SLOTS = [
  { id: "slot-1", label: "10:30 AM - 10:45 AM", capacity: 8, booked: 2, active: true },
  { id: "slot-2", label: "10:45 AM - 11:00 AM", capacity: 10, booked: 4, active: true },
  { id: "slot-3", label: "11:00 AM - 11:15 AM", capacity: 12, booked: 5, active: true },
  { id: "slot-4", label: "11:15 AM - 11:30 AM", capacity: 10, booked: 0, active: false },
];

export const DEFAULT_MENU_ITEMS = [
  { id: 1, name: "Masala Dosa", cat: "Breakfast", price: 45, time: 8, emoji: "🫓", desc: "Crispy rice crepe with spiced potato filling", popular: true, veg: true, active: true },
  { id: 2, name: "Idli Sambhar", cat: "Breakfast", price: 30, time: 5, emoji: "🍚", desc: "Steamed rice cakes with lentil soup", popular: false, veg: true, active: true },
  { id: 3, name: "Poha", cat: "Breakfast", price: 25, time: 6, emoji: "🍽️", desc: "Flattened rice with mustard seeds & peas", popular: true, veg: true, active: true },
  { id: 4, name: "Veg Thali", cat: "Lunch", price: 80, time: 12, emoji: "🍱", desc: "Complete meal: dal, sabzi, roti, rice & salad", popular: true, veg: true, active: true },
  { id: 5, name: "Chicken Biryani", cat: "Lunch", price: 120, time: 15, emoji: "🍛", desc: "Aromatic basmati rice with tender chicken", popular: true, veg: false, active: true },
  { id: 6, name: "Paneer Butter Masala", cat: "Lunch", price: 90, time: 10, emoji: "🧆", desc: "Cottage cheese in rich tomato-cream gravy", popular: false, veg: true, active: true },
  { id: 7, name: "Dal Tadka + Rice", cat: "Lunch", price: 65, time: 8, emoji: "🍲", desc: "Tempered yellow lentils with steamed rice", popular: false, veg: true, active: true },
  { id: 8, name: "Samosa (2 pcs)", cat: "Snacks", price: 20, time: 3, emoji: "🥟", desc: "Crispy pastry stuffed with spiced potatoes", popular: true, veg: true, active: true },
  { id: 9, name: "Vada Pav", cat: "Snacks", price: 15, time: 4, emoji: "🍔", desc: "Mumbai street burger with spicy potato patty", popular: true, veg: true, active: true },
  { id: 10, name: "Spring Rolls", cat: "Snacks", price: 35, time: 6, emoji: "🥢", desc: "Crispy rolls with mixed veggies filling", popular: false, veg: true, active: true },
  { id: 11, name: "Chai", cat: "Beverages", price: 12, time: 3, emoji: "☕", desc: "Classic Indian masala tea", popular: true, veg: true, active: true },
  { id: 12, name: "Cold Coffee", cat: "Beverages", price: 45, time: 4, emoji: "🥤", desc: "Chilled blended coffee with ice cream", popular: true, veg: true, active: true },
  { id: 13, name: "Lassi", cat: "Beverages", price: 30, time: 3, emoji: "🥛", desc: "Thick sweet yogurt drink", popular: false, veg: true, active: true },
  { id: 14, name: "Fresh Lime Soda", cat: "Beverages", price: 25, time: 2, emoji: "🍋", desc: "Refreshing lime with soda water", popular: false, veg: true, active: true },
  { id: 15, name: "Gulab Jamun", cat: "Desserts", price: 30, time: 2, emoji: "🍮", desc: "Soft milk-solid balls in rose syrup", popular: true, veg: true, active: true },
  { id: 16, name: "Ice Cream", cat: "Desserts", price: 40, time: 1, emoji: "🍨", desc: "Choice of vanilla, chocolate, or strawberry", popular: false, veg: true, active: true },
];

export const DEFAULT_ORDERS = [
  { id: "ORD-001", student: "Riya Sharma", items: [{ name: "Masala Dosa", qty: 2, price: 45 }, { name: "Chai", qty: 2, price: 12 }], total: 114, status: "preparing", time: "10:23 AM", token: "T-12", pickupSlot: "10:30 AM - 10:45 AM", pickupSlotId: "slot-1", paymentStatus: "paid", paymentId: "demo-payment-1" },
  { id: "ORD-002", student: "Aarav Mehta", items: [{ name: "Veg Thali", qty: 1, price: 80 }, { name: "Lassi", qty: 1, price: 30 }], total: 110, status: "ready", time: "10:18 AM", token: "T-11", pickupSlot: "10:45 AM - 11:00 AM", pickupSlotId: "slot-2", paymentStatus: "paid", paymentId: "demo-payment-2" },
  { id: "ORD-003", student: "Priya Nair", items: [{ name: "Chicken Biryani", qty: 1, price: 120 }], total: 120, status: "pending", time: "10:31 AM", token: "T-13", pickupSlot: "11:00 AM - 11:15 AM", pickupSlotId: "slot-3", paymentStatus: "paid", paymentId: "demo-payment-3" },
];
