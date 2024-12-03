import re

# Define the file path (adjust this to the location of your text file)
file_path = "normaltest2-afterupdate4.txt"

# Initialize variables to store the count of errors, slot statistics, and transaction hashes
error_count = 0
last_transaction_sentence = None
slots = []

# Define the patterns to search for
error_text = "Error fetching transaction slot difference"
transaction_text = "Average"
# Simplified regex pattern to capture only the number after "took"
slot_pattern = re.compile(r"took (\d+) slots")

# Open the file and process each line
with open(file_path, 'r') as file:
    for line in file:
        # Count occurrences of the error message
        if error_text in line:
            error_count += 1
        
        # Update the last transaction sentence
        if transaction_text in line:
            last_transaction_sentence = line.strip()
        
        # Search for slot numbers
        match = slot_pattern.search(line)
        if match:
            slot_number = int(match.group(1))
            slots.append(slot_number)

# Determine the highest and lowest slot numbers if any were found
if slots:
    highest_slot = max(slots)
    lowest_slot = min(slots)
else:
    highest_slot = None
    lowest_slot = None

# Print the results
print(f"Total number of errors: {error_count}")
print(f"Last transaction sentence: {last_transaction_sentence}")
print(f"Highest slot number: {highest_slot}")
print(f"Lowest slot number: {lowest_slot}")
