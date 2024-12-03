marker = "testunder"  # Replace with your marker text
input_file = "normaltest2-afterupdate3.txt"
output_file = "normaltest2-afterupdate4.txt"

with open(input_file, "r") as infile, open(output_file, "w") as outfile:
    for line in infile:
        outfile.write(line)
        if marker in line:
            break  # Stop writing after the marker
